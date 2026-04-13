// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > export and import with attributes and conditions', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
    });

    describe('API export', () => {
        it('exports playbook without attributes or conditions', () => {
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Export Plain Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                cy.apiExportPlaybook(playbook.id).then((exportData) => {
                    // * Verify basic export structure
                    expect(exportData.version).to.equal(1);
                    expect(exportData.title).to.equal('Export Plain Playbook');
                    expect(exportData.checklists).to.have.length.at.least(1);

                    // * Verify sensitive fields are excluded
                    expect(exportData.id).to.not.exist;
                    expect(exportData.team_id).to.not.exist;

                    // * Verify properties and conditions are omitted when not present
                    expect(exportData.properties).to.not.exist;
                    expect(exportData.conditions).to.not.exist;
                });
            });
        });

        it('exports playbook with attributes included', () => {
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Export With Attributes',
                userId: testUser.id,
            }).then((playbook) => {
                // # Add a text attribute
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Environment',
                    type: 'text',
                    attrs: {visibility: 'always', sortOrder: 0},
                });

                // # Add a select attribute with options
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Severity',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [
                            {name: 'Critical'},
                            {name: 'Major'},
                            {name: 'Minor'},
                        ],
                    },
                });

                cy.apiExportPlaybook(playbook.id).then((exportData) => {
                    // * Verify properties are present in export
                    expect(exportData.properties).to.have.length(2);

                    const envProp = exportData.properties.find((p) => p.name === 'Environment');
                    expect(envProp).to.exist;
                    expect(envProp.type).to.equal('text');
                    expect(envProp.id).to.be.a('string').and.not.be.empty;

                    const sevProp = exportData.properties.find((p) => p.name === 'Severity');
                    expect(sevProp).to.exist;
                    expect(sevProp.type).to.equal('select');
                    expect(sevProp.attrs.options).to.have.length(3);
                });
            });
        });

        it('exports playbook with attributes and conditions', () => {
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Export Full',
                userId: testUser.id,
            }).then((playbook) => {
                // # Add a select attribute
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Priority',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 0,
                        options: [{name: 'High'}, {name: 'Low'}],
                    },
                });

                cy.apiGetPropertyFields(playbook.id).then((fields) => {
                    const priorityField = fields.find((f) => f.name === 'Priority');
                    const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

                    // # Create a condition referencing the attribute
                    cy.apiCreatePlaybookCondition(playbook.id, {
                        is: {field_id: priorityField.id, value: [highOptionId]},
                    }).then((condition) => {
                        // # Attach condition to a checklist item
                        cy.apiAttachConditionToTask(playbook.id, 0, 0, condition.id);

                        cy.apiExportPlaybook(playbook.id).then((exportData) => {
                            // * Verify properties are in export
                            expect(exportData.properties).to.have.length(1);
                            expect(exportData.properties[0].name).to.equal('Priority');

                            // * Verify conditions are in export
                            expect(exportData.conditions).to.have.length(1);
                            expect(exportData.conditions[0].version).to.equal(1);
                            expect(exportData.conditions[0].condition_expr).to.exist;

                            // * Verify checklist item has condition_id in export
                            const firstItem = exportData.checklists[0].items[0];
                            expect(firstItem.condition_id).to.equal(condition.id);
                        });
                    });
                });
            });
        });
    });

    describe('API import', () => {
        it('round-trip: export then import preserves attributes', () => {
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Round Trip Source',
                userId: testUser.id,
            }).then((playbook) => {
                // # Add attributes
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Customer',
                    type: 'text',
                    attrs: {visibility: 'always', sortOrder: 0},
                });
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Impact',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [{name: 'High'}, {name: 'Medium'}, {name: 'Low'}],
                    },
                });

                // # Export the playbook
                cy.apiExportPlaybook(playbook.id).then((exportData) => {
                    // # Import into the same team
                    cy.apiImportPlaybook(exportData, testTeam.id).then((importResult) => {
                        expect(importResult.id).to.be.a('string').and.not.be.empty;
                        expect(importResult.id).to.not.equal(playbook.id);

                        // * Verify imported playbook has the same title
                        cy.apiGetPlaybook(importResult.id).then((imported) => {
                            expect(imported.title).to.equal('Round Trip Source');
                        });

                        // * Verify property fields were recreated with new IDs
                        cy.apiGetPropertyFields(importResult.id).then((importedFields) => {
                            expect(importedFields).to.have.length(2);

                            const customer = importedFields.find((f) => f.name === 'Customer');
                            expect(customer).to.exist;
                            expect(customer.type).to.equal('text');

                            const impact = importedFields.find((f) => f.name === 'Impact');
                            expect(impact).to.exist;
                            expect(impact.type).to.equal('select');
                            expect(impact.attrs.options).to.have.length(3);

                            // * Verify new IDs were generated
                            cy.apiGetPropertyFields(playbook.id).then((origFields) => {
                                const origCustomer = origFields.find((f) => f.name === 'Customer');
                                expect(customer.id).to.not.equal(origCustomer.id);
                            });
                        });
                    });
                });
            });
        });

        it('round-trip: export then import preserves conditions and task linkage', () => {
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Round Trip Conditions',
                userId: testUser.id,
            }).then((playbook) => {
                // # Add select attributes
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Status',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 0,
                        options: [{name: 'Active'}, {name: 'Resolved'}],
                    },
                });

                cy.apiGetPropertyFields(playbook.id).then((fields) => {
                    const statusField = fields.find((f) => f.name === 'Status');
                    const activeOptionId = statusField.attrs.options.find((o) => o.name === 'Active').id;

                    // # Create a condition
                    cy.apiCreatePlaybookCondition(playbook.id, {
                        is: {field_id: statusField.id, value: [activeOptionId]},
                    }).then((condition) => {
                        // # Attach condition to first task
                        cy.apiAttachConditionToTask(playbook.id, 0, 0, condition.id);

                        // # Export and import
                        cy.apiExportPlaybook(playbook.id).then((exportData) => {
                            cy.apiImportPlaybook(exportData, testTeam.id).then((importResult) => {
                                // * Verify the imported playbook has a condition on the task
                                cy.apiGetPlaybook(importResult.id).then((imported) => {
                                    const firstItem = imported.checklists[0].items[0];
                                    expect(firstItem.condition_id).to.be.a('string').and.not.be.empty;

                                    // * Verify the condition_id was remapped (not the original)
                                    expect(firstItem.condition_id).to.not.equal(condition.id);
                                });

                                // * Verify the imported property fields have new IDs referencing the import
                                cy.apiGetPropertyFields(importResult.id).then((importedFields) => {
                                    expect(importedFields).to.have.length(1);
                                    expect(importedFields[0].name).to.equal('Status');
                                    expect(importedFields[0].id).to.not.equal(statusField.id);
                                });
                            });
                        });
                    });
                });
            });
        });

        it('rejects import with unsupported version', () => {
            const badExport = {
                title: 'Bad Version Playbook',
                version: 999,
                checklists: [{title: 'Checklist', items: [{title: 'Task'}]}],
                reminder_timer_default_seconds: 86400,
                status_update_enabled: true,
                retrospective_enabled: true,
                create_channel_member_on_new_participant: true,
                create_channel_member_on_removed_participant: true,
            };

            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: `/plugins/playbooks/api/v0/playbooks/import?team_id=${testTeam.id}`,
                method: 'POST',
                body: badExport,
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(400);
            });
        });

        it('rejects import with playbook ID set', () => {
            const badExport = {
                id: 'some-fake-id',
                title: 'Has ID Playbook',
                version: 1,
                checklists: [{title: 'Checklist', items: [{title: 'Task'}]}],
                reminder_timer_default_seconds: 86400,
                status_update_enabled: true,
                retrospective_enabled: true,
                create_channel_member_on_new_participant: true,
                create_channel_member_on_removed_participant: true,
            };

            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: `/plugins/playbooks/api/v0/playbooks/import?team_id=${testTeam.id}`,
                method: 'POST',
                body: badExport,
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(400);
            });
        });
    });

    describe('UI import with attributes', () => {
        it('imports playbook with attributes via drag-and-drop', () => {
            // # First create and export a playbook with attributes to get a real fixture
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'UI Import Source',
                userId: testUser.id,
            }).then((playbook) => {
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Region',
                    type: 'text',
                    attrs: {visibility: 'always', sortOrder: 0},
                });
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Tier',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                        options: [{name: 'Gold'}, {name: 'Silver'}],
                    },
                });

                cy.apiExportPlaybook(playbook.id).then((exportData) => {
                    const exportBuffer = Cypress.Buffer.from(JSON.stringify(exportData));

                    // # Open the Playbooks list
                    cy.visit('/playbooks');
                    cy.findByTestId('playbooksLHSButton').click();

                    // # Drag-and-drop the export file
                    cy.findByTestId('playbook-list-scroll-container').selectFile(
                        {contents: exportBuffer, fileName: 'export.json', mimeType: 'application/json'},
                        {action: 'drag-drop'},
                    );

                    // * Verify the playbook editor opens with the correct title
                    cy.findByTestId('playbook-editor-title').should('contain', 'UI Import Source');

                    // # Navigate to attributes
                    cy.findByText('Attributes').click();

                    // * Verify attributes were imported
                    cy.findAllByTestId('property-field-row').should('have.length', 2);
                });
            });
        });

        it('imports playbook with attributes via file input', () => {
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'UI Input Import Source',
                userId: testUser.id,
            }).then((playbook) => {
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Priority Level',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 0,
                        options: [{name: 'P1'}, {name: 'P2'}, {name: 'P3'}],
                    },
                });

                cy.apiExportPlaybook(playbook.id).then((exportData) => {
                    const exportBuffer = Cypress.Buffer.from(JSON.stringify(exportData));

                    // # Open the Playbooks list
                    cy.visit('/playbooks');
                    cy.findByTestId('playbooksLHSButton').click();

                    // # Use the file input to import
                    cy.findByTestId('titlePlaybook').within(() => {
                        cy.findByTestId('playbook-import-input').selectFile(
                            {contents: exportBuffer, fileName: 'export.json', mimeType: 'application/json'},
                            {force: true},
                        );
                    });

                    // * Verify the playbook editor opens with the correct title
                    cy.findByTestId('playbook-editor-title').should('contain', 'UI Input Import Source');

                    // # Navigate to attributes
                    cy.findByText('Attributes').click();

                    // * Verify the select attribute was imported with its options
                    cy.findAllByTestId('property-field-row').should('have.length', 1);
                    cy.findAllByTestId('property-field-row').eq(0).within(() => {
                        cy.findByText('P1').should('exist');
                        cy.findByText('P2').should('exist');
                        cy.findByText('P3').should('exist');
                    });
                });
            });
        });

        it('imports playbook with conditions and verifies task linkage in UI', () => {
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'UI Condition Import',
                userId: testUser.id,
            }).then((playbook) => {
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Urgency',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 0,
                        options: [{name: 'Urgent'}, {name: 'Normal'}],
                    },
                });

                cy.apiGetPropertyFields(playbook.id).then((fields) => {
                    const urgencyField = fields.find((f) => f.name === 'Urgency');
                    const urgentOptionId = urgencyField.attrs.options.find((o) => o.name === 'Urgent').id;

                    cy.apiCreatePlaybookCondition(playbook.id, {
                        is: {field_id: urgencyField.id, value: [urgentOptionId]},
                    }).then((condition) => {
                        cy.apiAttachConditionToTask(playbook.id, 0, 0, condition.id);

                        cy.apiExportPlaybook(playbook.id).then((exportData) => {
                            const exportBuffer = Cypress.Buffer.from(JSON.stringify(exportData));

                            // # Open the Playbooks list
                            cy.visit('/playbooks');
                            cy.findByTestId('playbooksLHSButton').click();

                            // # Import via drag-and-drop
                            cy.findByTestId('playbook-list-scroll-container').selectFile(
                                {contents: exportBuffer, fileName: 'export.json', mimeType: 'application/json'},
                                {action: 'drag-drop'},
                            );

                            // * Verify the playbook editor opens
                            cy.findByTestId('playbook-editor-title').should('contain', 'UI Condition Import');

                            // # Navigate to Outline to check condition
                            cy.findByText('Outline').click();

                            // * Verify condition was imported and linked to task
                            cy.findByTestId('condition-header').should('exist');
                            cy.findByTestId('condition-header').within(() => {
                                cy.findByText('Urgency').should('exist');
                            });
                        });
                    });
                });
            });
        });
    });
});
