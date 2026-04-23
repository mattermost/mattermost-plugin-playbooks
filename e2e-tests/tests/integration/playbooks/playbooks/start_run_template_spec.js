// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

const PREVIEW_LABEL = 'Preview:';

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

    describe('property field inputs and name preview', () => {
        let templatePlaybook;

        beforeEach(() => {
            // # Create a playbook with run_name_template and a Severity property field
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Template PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Severity',
                    type: 'select',
                    attrs: {
                        options: [{name: 'Critical'}, {name: 'Low'}],
                    },
                }).then(() => {
                    return cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{Severity}'});
                }).then(() => {
                    // Re-fetch to get the final state with run_name_template saved
                    return cy.apiGetPlaybook(playbook.id).then((finalPlaybook) => {
                        templatePlaybook = finalPlaybook;
                    });
                });
            });
        });

        it('shows property field inputs for fields referenced in run_name_template', () => {
            // * Verify via API that the playbook has a Severity field and the template references it
            cy.apiGetPlaybook(templatePlaybook.id).then((pb) => {
                expect(pb.channel_name_template).to.include('{Severity}');
            });

            cy.apiGetPropertyFields(templatePlaybook.id).then((fields) => {
                const field = fields.find((f) => f.name === 'Severity');
                expect(field).to.exist;
            });

            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(templatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert "Attributes" section is visible
                cy.contains('Attributes').should('exist');

                // * Assert Severity property field label is visible
                cy.contains('Severity').should('exist');
            });
        });

        it('shows name preview that updates when property field is filled', () => {
            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(templatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert name preview exists and shows the preview label
                cy.findByTestId('run-name-preview').should('exist').and('contain', PREVIEW_LABEL);

                // # Open the Severity select (react-select control)
                cy.get('.playbooks-rselect__control').first().click();
            });

            // # Wait for dropdown options to render, then select "Critical"
            cy.get('.playbooks-rselect__option').should('have.length.greaterThan', 0);
            cy.get('.playbooks-rselect__option').contains('Critical').click();

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert name preview now contains "Critical"
                cy.findByTestId('run-name-preview').should('contain', 'Critical');
            });
        });

        it('submit button is disabled when required property fields are empty', () => {
            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(templatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert submit button is disabled (Severity not filled)
                cy.findByTestId('modal-confirm-button').should('be.disabled');
            });
        });

        it('submit button enables once required property fields are filled', () => {
            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(templatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert submit button is initially disabled
                cy.findByTestId('modal-confirm-button').should('be.disabled');

                // # Open the Severity select (react-select control)
                cy.get('.playbooks-rselect__control').first().click();
            });

            // # Wait for dropdown options to render, then select "Critical"
            cy.get('.playbooks-rselect__option').should('have.length.greaterThan', 0);
            cy.get('.playbooks-rselect__option').contains('Critical').click();

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert submit button is now enabled
                cy.findByTestId('modal-confirm-button').should('not.be.disabled');
            });
        });

        it('creates run with template-resolved name when property fields are filled', () => {
            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(templatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // # Open the Severity select (react-select control)
                cy.get('.playbooks-rselect__control').first().click();
            });

            // # Wait for dropdown options to render, then select "Critical"
            cy.get('.playbooks-rselect__option').should('have.length.greaterThan', 0);
            cy.get('.playbooks-rselect__option').contains('Critical').click();

            cy.get('#root-portal.modal-open').within(() => {
                // # Submit
                cy.findByTestId('modal-confirm-button').click();
            });

            // * Verify we are on the run details page
            cy.url().should('include', '/playbooks/runs/');
            cy.url().should('include', '?from=run_modal');

            // * Verify run name contains "Critical" (from the resolved template)
            cy.get('h1').should('contain', 'Critical');

            // * Verify backend state: run.name is resolved and property_values are stored
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.assertRunNameResolved(runId, 'Critical');
                cy.assertRunHasPropertyValues(runId);
                cy.assertRunPropertyValueStored(runId, 'Severity');

                // * Verify via API that property_values are non-empty on the run
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.property_values).to.not.be.empty;
                });
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
