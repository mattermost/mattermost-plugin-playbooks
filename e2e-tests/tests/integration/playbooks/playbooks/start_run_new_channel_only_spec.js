// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('playbooks > start a run > new_channel_only modal enforcement', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let createdPlaybookIds = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    describe('when new_channel_only is true', () => {
        let restrictedPlaybook;

        beforeEach(() => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'NewChannelOnly Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);

                // # Enable new_channel_only directly via API to avoid UI flakiness
                playbook.new_channel_only = true;
                cy.apiUpdatePlaybook(playbook).then(() => {
                    restrictedPlaybook = playbook;
                });
            });
        });

        it('"Link to existing channel" radio is disabled', () => {
            // * Verify via API that new_channel_only is true on the playbook
            cy.apiGetPlaybook(restrictedPlaybook.id).then((pb) => {
                expect(pb.new_channel_only).to.equal(true);
            });

            // # Open the run modal from the playbook editor
            cy.playbooksOpenRunModal(restrictedPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert the "Link to existing channel" radio is disabled
                cy.findByTestId('link-existing-channel-radio').should('be.disabled');
            });
        });

        it('"Create a run channel" radio is checked and enabled', () => {
            // # Open the run modal from the playbook editor
            cy.playbooksOpenRunModal(restrictedPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert the "Create a run channel" radio is checked
                cy.findByTestId('create-channel-radio').should('be.checked');

                // * Assert the "Create a run channel" radio is not disabled
                cy.findByTestId('create-channel-radio').should('not.be.disabled');
            });
        });

        it('enforcement hint message is visible below the disabled radio', () => {
            // # Open the run modal from the playbook editor
            cy.playbooksOpenRunModal(restrictedPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert the enforcement hint is shown
                cy.get('#new-channel-only-hint').
                    should('be.visible').
                    and('contain', 'This playbook requires a new channel for each run');
            });
        });

        it('channel selector is not rendered', () => {
            // # Open the run modal from the playbook editor
            cy.playbooksOpenRunModal(restrictedPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert the channel selector is absent (only rendered when link_existing_channel is active)
                cy.get('#link-existing-channel-selector').should('not.exist');
            });
        });

        it('run can be started (modal submits successfully with new channel mode)', () => {
            // # Open the run modal from the playbook editor
            cy.playbooksOpenRunModal(restrictedPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // # Type a run name
                cy.findByTestId('run-name-input').clear().type('NewChannelOnly Run ' + getRandomId());

                // # Submit
                cy.findByTestId('modal-confirm-button').click();
            });

            // * Assert we land on the run details page (run was created successfully)
            cy.url().should('include', '/playbooks/runs/');

            // * Assert via API that the run was created with a new channel (channel_id is set)
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.channel_id, 'run should have a new channel_id').to.be.a('string').and.not.be.empty;

                    // * Verify via API that the associated channel exists
                    cy.apiGetChannel(run.channel_id).then(({channel}) => {
                        expect(channel).to.exist;
                    });
                });
            });
        });
    });

    describe('new_channel_only toggle in the playbook editor', () => {
        let togglePlaybook;

        beforeEach(() => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Toggle Test Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                togglePlaybook = playbook;
            });
        });

        it('persists the flag via the UI toggle', () => {
            cy.visit(`/playbooks/playbooks/${togglePlaybook.id}/outline`);
            cy.playbooksToggleWithConfirmation('new-channel-only-toggle');

            cy.apiGetPlaybook(togglePlaybook.id).then((pb) => {
                expect(pb.new_channel_only, 'new_channel_only should be true after toggle').to.equal(true);
            });
        });

        it('shows a confirmation dialog with the correct title, message and button when enabling', () => {
            cy.visit(`/playbooks/playbooks/${togglePlaybook.id}/outline`);
            cy.findByTestId('new-channel-only-toggle').find('label').click();

            cy.get('#confirmModal').within(() => {
                cy.get('#confirmModalLabel').should('contain', 'Require new channel for all runs');
                cy.get('#confirmModalBody').should('contain', 'Enabling this will prevent runs from linking to existing channels');
                cy.get('#confirmModalButton').should('contain', 'Confirm');
            });
            cy.get('#cancelModalButton').click();
        });

        it('disables the flag without a confirmation dialog', () => {
            // Enable via API so we start with new_channel_only=true
            togglePlaybook.new_channel_only = true;
            cy.apiUpdatePlaybook(togglePlaybook);

            cy.visit(`/playbooks/playbooks/${togglePlaybook.id}/outline`);
            cy.findByTestId('new-channel-only-toggle').find('label').click();

            cy.get('#confirmModal').should('not.exist');

            // Wait for the UI to reflect the update before querying the API — the PATCH is async
            // and the API call would otherwise race against it and read stale state.
            cy.findByTestId('new-channel-only-toggle').find('input').should('not.be.checked');
            cy.apiGetPlaybook(togglePlaybook.id).then((pb) => {
                expect(pb.new_channel_only, 'new_channel_only should be false after disabling').to.equal(false);
            });
        });
    });

    describe('when new_channel_only is false (regression)', () => {
        let openPlaybook;

        beforeEach(() => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Open Channel Playbook ' + getRandomId(),
                memberIDs: [testUser.id],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
                openPlaybook = playbook;
            });
        });

        it('"Link to existing channel" radio is enabled', () => {
            // # Open the run modal from the playbook editor
            cy.playbooksOpenRunModal(openPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert the "Link to existing channel" radio is not disabled
                cy.findByTestId('link-existing-channel-radio').should('not.be.disabled');
            });
        });

        it('enforcement hint message is not shown', () => {
            // # Open the run modal from the playbook editor
            cy.playbooksOpenRunModal(openPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert the enforcement hint is absent
                cy.get('#new-channel-only-hint').should('not.exist');
            });
        });
    });
});
