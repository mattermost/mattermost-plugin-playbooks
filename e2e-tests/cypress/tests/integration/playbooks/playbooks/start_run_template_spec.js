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

    afterEach(() => {
        cy.apiLogin(testUser);
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
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{OWNER}'}).then(() => {
                    seqTemplatePlaybook = playbook;
                });
            });
        });

        afterEach(() => {
            if (seqTemplatePlaybook) {
                cy.apiArchivePlaybook(seqTemplatePlaybook.id);
            }
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

    describe('many property fields — Cancel button remains reachable', () => {
        let manyFieldsPlaybook;

        beforeEach(() => {
            const fieldNames = ['Priority', 'Region', 'Team', 'Environment'];

            // # Create playbook, then add 4 fields and set template — all chained to keep async ordering correct
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'ManyFields PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                manyFieldsPlaybook = playbook;

                fieldNames.forEach((name, i) => {
                    cy.apiAddPropertyField(playbook.id, {
                        name,
                        type: 'text',
                        attrs: {visibility: 'always', sortOrder: i},
                    });
                });

                const template = fieldNames.map((n) => `{${n}}`).join(' - ');
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: template});
            });
        });

        afterEach(() => {
            if (manyFieldsPlaybook) {
                cy.apiArchivePlaybook(manyFieldsPlaybook.id);
            }
        });

        it('Cancel button is visible and clickable when modal shows many attribute inputs', () => {
            // # Open the Start Run modal
            cy.playbooksOpenRunModal(manyFieldsPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * All 4 attribute inputs are rendered
                cy.findByText('Attributes').should('be.visible');

                // * The Cancel button is visible within the viewport — not pushed off-screen
                cy.findByTestId('modal-cancel-button').should('be.visible');

                // # Click Cancel — modal should close without starting a run
                cy.findByTestId('modal-cancel-button').click();
            });

            // * Modal is gone after Cancel
            cy.get('#root-portal.modal-open').should('not.exist');
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

        afterEach(() => {
            if (plainPlaybook) {
                cy.apiArchivePlaybook(plainPlaybook.id);
            }
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

    describe('template name too long', () => {
        let longTemplatePlaybook;

        beforeEach(() => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Long Template PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                longTemplatePlaybook = playbook;

                // # 65-char static template exceeds the 64-char run name limit
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'x'.repeat(65)});
            });
        });

        afterEach(() => {
            if (longTemplatePlaybook) {
                cy.apiArchivePlaybook(longTemplatePlaybook.id);
            }
        });

        it('shows inline error and disables submit when resolved run name exceeds 64 characters', () => {
            cy.playbooksOpenRunModal(longTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Inline error mentions the 64-character limit
                cy.findByTestId('run-name-preview-error').should('be.visible');
                cy.findByTestId('run-name-preview-error').should('contain', '64');

                // * Submit button is disabled
                cy.findByTestId('modal-confirm-button').should('be.disabled');
            });
        });
    });
});
