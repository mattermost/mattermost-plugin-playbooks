// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run_attributes', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Set viewport to show RHS
        cy.viewport('macbook-13');
    });

    describe('empty state', () => {
        beforeEach(() => {
            // # Create playbook without attributes
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook Without Attributes',
                memberIDs: [testUser.id],
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Start a run
                return cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Test Run',
                    ownerUserId: testUser.id,
                });
            }).then((run) => {
                testRun = run;

                // # Navigate to run
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });
        });

        it('does not show attributes section when playbook has no attributes', () => {
            // * Verify Attributes section does NOT exist
            cy.findByRole('complementary').within(() => {
                cy.findByText('Attributes').should('not.exist');
            });
        });
    });

    describe('attribute inheritance', () => {
        it('copies text attribute from playbook to run', () => {
            // # Create playbook with text attribute
            createPlaybookWithAttributes([
                {name: 'Project Name', type: 'text'},
            ]);

            // # Start a run
            startRun('Test Run With Text Attr');

            // # Navigate to run
            navigateToRun();

            // * Verify attribute appears in RHS
            verifyAttributeExists('Project Name');
            verifyAttributeValue('Project Name', 'Empty');
        });

        it('copies all attribute types from playbook to run', () => {
            // # Create playbook with all attribute types
            createPlaybookWithAttributes([
                {name: 'Description', type: 'text'},
                {name: 'Status', type: 'select', options: ['Not Started', 'In Progress', 'Complete']},
                {name: 'Teams', type: 'multiselect', options: ['Engineering', 'Design', 'Product']},
            ]);

            // # Start a run
            startRun('Test Run With All Attrs');

            // # Navigate to run
            navigateToRun();

            // * Verify all attributes appear
            verifyAttributeExists('Description');
            verifyAttributeValue('Description', 'Empty');

            verifyAttributeExists('Status');
            verifyAttributeValue('Status', 'Empty');

            verifyAttributeExists('Teams');
            verifyAttributeValue('Teams', 'Empty');
        });
    });

    describe('edit attribute values', () => {
        beforeEach(() => {
            // # Create playbook with attributes
            createPlaybookWithAttributes([
                {name: 'Notes', type: 'text'},
                {name: 'Priority', type: 'select', options: ['Low', 'Medium', 'High']},
                {name: 'Labels', type: 'multiselect', options: ['Bug', 'Feature', 'Enhancement']},
            ]);

            // # Start a run
            startRun('Test Run For Editing');
        });

        describe('from run details page', () => {
            beforeEach(() => {
                // # Navigate to run details page
                navigateToRun();
            });

            it('can edit text attribute value', () => {
                // # Edit text attribute
                editTextAttribute('Notes', 'Initial implementation notes');
                cy.wait(500);

                // * Verify value is displayed
                verifyAttributeValue('Notes', 'Initial implementation notes');

                // # Reload page
                cy.reload();

                // * Verify value persists
                verifyAttributeValue('Notes', 'Initial implementation notes');
            });

            it('can edit select attribute value', () => {
                // # Edit select attribute
                editSelectAttribute('Priority', 'High');
                cy.wait(500);

                // * Verify selected value is displayed
                verifyAttributeValue('Priority', 'High');

                // # Change selection
                editSelectAttribute('Priority', 'Low');
                cy.wait(500);

                // * Verify updated value
                verifyAttributeValue('Priority', 'Low');
            });

            it('can edit multiselect attribute value', () => {
                // # Click on multiselect attribute
                clickAttributeToEdit('Labels');

                // # Select multiple options
                cy.findByText('Bug').click();
                cy.findByText('Enhancement').click();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify both values are displayed
                getAttributeRow('Labels').within(() => {
                    cy.contains('Bug').should('exist');
                    cy.contains('Enhancement').should('exist');
                });

                // # Add another selection
                clickAttributeToEdit('Labels');
                cy.findByText('Feature').click();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify all three values displayed
                getAttributeRow('Labels').within(() => {
                    cy.contains('Bug').should('exist');
                    cy.contains('Feature').should('exist');
                    cy.contains('Enhancement').should('exist');
                });
            });

            it('can clear text attribute value', () => {
                // # Set a value first
                editTextAttribute('Notes', 'Test summary');
                cy.wait(500);

                // * Verify value is set
                verifyAttributeValue('Notes', 'Test summary');

                // # Click to edit and clear
                clickAttributeToEdit('Notes');
                cy.focused().clear();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify empty state returns
                verifyAttributeValue('Notes', 'Empty');
            });

            it('can clear select attribute value', () => {
                // # Set a value first
                editSelectAttribute('Priority', 'High');
                cy.wait(500);

                // * Verify value is set
                verifyAttributeValue('Priority', 'High');

                // # Click to edit
                clickAttributeToEdit('Priority');

                // # Click clear indicator
                getAttributeRow('Priority').within(() => {
                    cy.get('div.property-select__clear-indicator').click();
                });
                cy.wait(500);

                // * Verify empty state returns
                verifyAttributeValue('Priority', 'Empty');
            });

            it('can clear multiselect attribute value', () => {
                // # Set values first
                clickAttributeToEdit('Labels');
                cy.findByText('Bug').click();
                cy.findByText('Feature').click();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify values are set
                getAttributeRow('Labels').within(() => {
                    cy.contains('Bug').should('exist');
                    cy.contains('Feature').should('exist');
                });

                // # Click to edit
                clickAttributeToEdit('Labels');

                cy.wait(500);

                // # Click clear indicator
                getAttributeRow('Labels').within(() => {
                    cy.get('div.property-select__clear-indicator').realClick();
                });
                cy.wait(500);

                // * Verify empty state returns
                verifyAttributeValue('Labels', 'Empty');
            });
        });

        describe('from channel RHS', () => {
            beforeEach(() => {
                // # Navigate to the run's channel
                cy.then(() => {
                    cy.visit(`/${testTeam.name}/channels/${testRun.channel_id}`);
                });
            });

            it('can edit text attribute value and see post', () => {
                // # Edit text attribute
                editTextAttribute('Notes', 'Channel edit notes');
                cy.wait(500);

                // * Verify value is displayed
                verifyAttributeValue('Notes', 'Channel edit notes');

                // * Verify message posted in channel
                cy.get('#postListContent').within(() => {
                    cy.contains('Notes').should('exist');
                });
            });

            it('can edit select attribute value and see post', () => {
                // # Edit select attribute
                editSelectAttribute('Priority', 'Medium');
                cy.wait(500);

                // * Verify selected value is displayed
                verifyAttributeValue('Priority', 'Medium');

                // * Verify message posted in channel
                cy.get('#postListContent').within(() => {
                    cy.contains('Priority').should('exist');
                });
            });

            it('can edit multiselect attribute value and see post', () => {
                // # Click on multiselect attribute
                clickAttributeToEdit('Labels');

                // # Select multiple options
                cy.findByText('Feature').click();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify value is displayed
                getAttributeRow('Labels').within(() => {
                    cy.contains('Feature').should('exist');
                });

                // * Verify message posted in channel
                cy.get('#postListContent').within(() => {
                    cy.contains('Labels').should('exist');
                });
            });
        });
    });

    describe('attribute independence', () => {
        it('run attributes remain independent when playbook attributes change', () => {
            // # Create playbook with attributes
            createPlaybookWithAttributes([
                {name: 'Instance ID', type: 'text'},
                {name: 'Region', type: 'select', options: ['US-East', 'US-West', 'EU']},
            ]);

            // # Start a run
            startRun('Test Run');

            // # Navigate to run and set values
            navigateToRun();
            editTextAttribute('Instance ID', 'inst-001');
            editSelectAttribute('Region', 'US-East');

            // * Verify values are set
            verifyAttributeValue('Instance ID', 'inst-001');
            verifyAttributeValue('Region', 'US-East');

            // # Navigate to playbook attributes tab
            cy.then(() => {
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/attributes`);
            });

            // # Remove Region attribute
            cy.findByText('Region').parent().parent().within(() => {
                cy.findByLabelText('Delete').click();
            });
            cy.findByText('Delete attribute').click();

            // # Add new attribute
            cy.findByText('+ Add attribute').click();
            cy.findByPlaceholderText('Attribute name').type('Environment');
            cy.findByText('Select').click();
            cy.findByPlaceholderText('Add an option').type('Dev{enter}');
            cy.findByPlaceholderText('Add an option').type('Staging{enter}');
            cy.findByPlaceholderText('Add an option').type('Prod{enter}');
            cy.findByText('Done').click();

            // # Navigate back to run
            navigateToRun();

            // * Verify run still has original attributes and values
            verifyAttributeValue('Instance ID', 'inst-001');
            verifyAttributeValue('Region', 'US-East');

            // * Verify new playbook attribute does NOT appear on run
            cy.findByRole('complementary').within(() => {
                cy.findByText('Environment').should('not.exist');
            });
        });
    });

    /**
     * Helper Functions
     */

    /**
     * Navigate to the current test run
     */
    function navigateToRun() {
        cy.then(() => {
            cy.visit(`/playbooks/runs/${testRun.id}`);
        });
    }

    /**
     * Create a playbook with specified attributes
     * @param {Array} attributes - Array of attribute objects {name, type, options}
     */
    function createPlaybookWithAttributes(attributes) {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Playbook For Testing',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            testPlaybook = playbook;
        });

        // Add each attribute sequentially
        attributes.forEach((attr, index) => {
            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: attr.name,
                    type: attr.type,
                    attrs: {
                        visibility: 'always',
                        sortOrder: index + 1,
                        options: attr.options ? attr.options.map((opt) => ({name: opt})) : undefined,
                    },
                });
            });
        });
    }

    /**
     * Start a run from the current test playbook
     * @param {string} runName - Name for the run
     */
    function startRun(runName) {
        cy.then(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: runName,
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;
            });
        });
    }

    /**
     * Get the attribute row for a given attribute name
     * @param {string} attributeName - Name of the attribute
     */
    function getAttributeRow(attributeName) {
        const testId = `run-property-${attributeName.toLowerCase().replace(/\s+/g, '-')}`;
        return cy.findByTestId(testId);
    }

    /**
     * Verify an attribute exists in the RHS
     * @param {string} attributeName - Name of the attribute
     */
    function verifyAttributeExists(attributeName) {
        const testId = `run-property-${attributeName.toLowerCase().replace(/\s+/g, '-')}`;
        cy.findByRole('complementary').within(() => {
            cy.findByTestId(testId).should('exist');
        });
    }

    /**
     * Verify an attribute has a specific value
     * @param {string} attributeName - Name of the attribute
     * @param {string} expectedValue - Expected value text
     */
    function verifyAttributeValue(attributeName, expectedValue) {
        getAttributeRow(attributeName).within(() => {
            cy.contains(expectedValue).should('exist');
        });
    }

    /**
     * Click on an attribute to start editing
     * @param {string} attributeName - Name of the attribute
     */
    function clickAttributeToEdit(attributeName) {
        getAttributeRow(attributeName).within(() => {
            // Click on the property value (empty state or existing value)
            cy.findByTestId('property-value').click();
        });
    }

    /**
     * Edit a text attribute value
     * @param {string} attributeName - Name of the attribute
     * @param {string} value - Value to type
     */
    function editTextAttribute(attributeName, value) {
        clickAttributeToEdit(attributeName);
        cy.focused().type(value);
        cy.get('body').click(0, 0);
    }

    /**
     * Edit a select attribute value
     * @param {string} attributeName - Name of the attribute
     * @param {string} option - Option to select
     */
    function editSelectAttribute(attributeName, option) {
        clickAttributeToEdit(attributeName);
        cy.findByText(option).click();
    }
});
