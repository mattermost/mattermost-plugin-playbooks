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

                // # Enable new_channel_only via the playbook editor UI toggle
                cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);
                cy.playbooksToggleWithConfirmation('new-channel-only-toggle');

                // * Verify new_channel_only was persisted via API
                cy.apiGetPlaybook(playbook.id).then((pb) => {
                    expect(pb.new_channel_only, 'new_channel_only should be true after toggle').to.equal(true);
                });

                restrictedPlaybook = playbook;
            });
        });

        it('"Link to existing channel" radio is disabled', () => {
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
                });
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
