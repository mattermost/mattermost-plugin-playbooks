// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('playbooks > start a run > template mode (React modal)', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    describe('name field is not required when template is set', () => {
        let seqTemplatePlaybook;

        beforeEach(() => {
            // # Create a playbook with a system-token-only template (no property fields required)
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'SeqTemplate PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                const playbookId = playbook.id;
                cy.apiPatchPlaybook(playbookId, {channel_name_template: '{OWNER}'}).then(() => {
                    cy.apiGetPlaybook(playbookId).then((finalPlaybook) => {
                        seqTemplatePlaybook = finalPlaybook;
                    });
                });
            });
        });

        it('submit button is enabled even when name input shows template (no required fields)', () => {
            // * Verify via API that the playbook's channel_name_template includes {OWNER}
            cy.apiGetPlaybook(seqTemplatePlaybook.id).then((pb) => {
                expect(pb.channel_name_template).to.include('{OWNER}');
            });

            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(seqTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert run name input is pre-filled with the template
                cy.findByTestId('run-name-input').should('have.value', '{OWNER}');

                // * Assert Start run is enabled — the template drives naming, no required fields to fill
                cy.findByTestId('modal-confirm-button').should('not.be.disabled');
            });
        });
    });

    describe('no-template free-text mode', () => {
        let plainPlaybook;

        beforeEach(() => {
            // # Create a playbook WITHOUT run_name_template
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Plain PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                plainPlaybook = playbook;
            });
        });

        it('shows free-text name input without "(optional)" label', () => {
            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(plainPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert name input is visible
                cy.findByTestId('run-name-input').should('exist');

                // * Assert no "(optional)" label is shown
                cy.findByText('(optional)').should('not.exist');

                // * Assert no "Attributes" section is shown
                cy.findByText('Attributes').should('not.exist');

                // * Assert no name preview is shown
                cy.findByTestId('run-name-preview').should('not.exist');
            });
        });

        it('submit button is disabled when name is empty (no template)', () => {
            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(plainPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert name input is empty
                cy.findByTestId('run-name-input').should('have.value', '');

                // * Assert submit button is disabled
                cy.findByTestId('modal-confirm-button').should('be.disabled');
            });
        });

        it('submit enables and run is created when name is typed', () => {
            const runName = 'Manual Run ' + getRandomId();

            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(plainPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // # Type a run name
                cy.findByTestId('run-name-input').clear().type(runName);

                // * Assert submit button is now enabled
                cy.findByTestId('modal-confirm-button').should('not.be.disabled');

                // # Submit
                cy.findByTestId('modal-confirm-button').click();
            });

            // * Verify we are on the run details page
            cy.url().should('include', '/playbooks/runs/');

            // * Verify run name
            cy.get('h1').contains(runName);

            // * Verify backend state: run name is stored correctly
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.name, 'run name should be stored server-side').to.equal(runName);
                });
            });
        });
    });
});
