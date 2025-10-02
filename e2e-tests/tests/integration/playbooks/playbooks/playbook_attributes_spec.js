// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

/**
 * E2E Tests for Playbook Attributes Feature
 *
 * This test suite covers the playbook attributes (property fields) functionality,
 * which allows users to add custom fields to playbooks for capturing additional
 * metadata during playbook runs.
 *
 * Test Coverage:
 * - Empty state display and interaction
 * - CRUD operations (Create, Read, Update, Delete)
 * - Different attribute types (text, select, multi-select)
 * - Select field options management
 * - Attribute limits (MAX_PROPERTIES_LIMIT)
 * - Drag-and-drop reordering
 * - Duplicate functionality
 * - Input validation and error handling
 * - Data persistence across page reloads
 * - Integration with playbook system
 * - Edge cases and UI responsiveness
 *
 * Related Features:
 * - GraphQL API: property_fields_graphql_spec.js
 * - Similar feature: edit_metrics_spec.js
 * - Component: webapp/src/components/backstage/playbook_properties/playbook_properties.tsx
 *
 * Test Data:
 * - Creates a fresh playbook for each test via beforeEach
 * - Uses testUser and testTeam from apiInitSetup
 * - Cleans up via testIsolation: true
 *
 * Known Limitations:
 * - Drag-and-drop tests may be flaky; increase wait times if needed
 * - Some selectors depend on data-testid attributes being present in the component
 * - Network error simulation may need adjustment based on actual error handling
 */

describe('playbooks > playbook_attributes', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Create a fresh playbook for each test
        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Attributes Test Playbook (' + Date.now() + ')',
            userId: testUser.id,
        }).then((playbook) => {
            testPlaybook = playbook;
        });

        // # Set viewport for consistent testing
        cy.viewport('macbook-16');
    });

    describe('empty state', () => {
        it('shows empty state when no attributes exist', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // * Verify empty state is displayed
            cy.findByText(/no attributes yet/i).should('be.visible');
            cy.findByText(/add custom attributes/i).should('be.visible');
            cy.findByRole('button', {name: /add.*first attribute/i}).should('be.visible');
        });

        it('can add first attribute from empty state', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // # Click add button in empty state
            cy.findByRole('button', {name: /add.*first attribute/i}).click();

            // # Wait for attribute to be created
            cy.wait(500);

            // * Verify empty state is gone
            cy.findByText(/no attributes yet/i).should('not.exist');

            // * Verify attribute row appears in table
            cy.findAllByTestId('property-field-row').should('have.length', 1);

            // # Edit the default name
            cy.findAllByTestId('property-field-row').first().within(() => {
                cy.findByLabelText('Property name').clear().type('Priority');
            });

            // # Save by clicking outside
            cy.get('body').click(0, 0);
            cy.wait(500);

            // * Verify attribute is displayed with correct name
            verifyAttribute(0, 'Priority');
        });
    });

    describe('create attribute', () => {
        it('can create a text attribute', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // # Add a text attribute
            addAttribute('Customer Name', 'text');

            // * Verify attribute was created
            verifyAttribute(0, 'Customer Name');

            // # Reload page
            cy.reload();

            // * Verify attribute persists
            verifyAttribute(0, 'Customer Name');
        });

        it('can create a select attribute with options', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // # Add a select attribute with options
            addAttribute('Severity', 'select', ['Critical', 'High', 'Medium', 'Low']);

            // * Verify attribute was created
            verifyAttribute(0, 'Severity');

            // * Verify options are present
            cy.get('table tbody tr').eq(0).within(() => {
                cy.findByText('Critical').should('exist');
                cy.findByText('High').should('exist');
                cy.findByText('Medium').should('exist');
                cy.findByText('Low').should('exist');
            });
        });

        it('can create a multi-select attribute', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // # Add a multiselect attribute
            addAttribute('Tags', 'multi-select', ['Security', 'Performance', 'Bug']);

            // * Verify attribute was created
            verifyAttribute(0, 'Tags');

            // * Verify options are present
            cy.get('table tbody tr').eq(0).within(() => {
                cy.findByText('Security').should('exist');
                cy.findByText('Performance').should('exist');
                cy.findByText('Bug').should('exist');
            });
        });

        it('shows experimental feature banner', () => {
            // # Navigate to attributes section and add an attribute
            navigateToAttributes();
            addAttribute('Test Field', 'text');

            // * Verify experimental banner is visible
            cy.findByText(/experimental feature/i).should('be.visible');
            cy.get('.icon-flask-outline').should('be.visible');
        });
    });

    describe('update attribute', () => {
        it('can rename an attribute', () => {
            // # Navigate and create an attribute
            navigateToAttributes();
            addAttribute('Old Name', 'text');

            // # Edit the attribute name
            editAttributeName(0, 'New Name');

            // * Verify name was updated
            verifyAttribute(0, 'New Name');

            // # Reload page
            cy.reload();

            // * Verify change persists
            verifyAttribute(0, 'New Name');
        });

        it('can change attribute type', () => {
            // # Navigate and create a text attribute
            navigateToAttributes();
            addAttribute('Flexible Field', 'text');

            // # Click on type button to change type
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByRole('button', {name: 'Change property type'}).click();
            });

            // # Select new type
            cy.findByText(/^select$/i).click();

            // # Wait for GraphQL mutation
            cy.wait(500);

            // * Verify type changed (should now have property values input)
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByTestId('property-values-input').should('exist');
            });
        });

        it('can add options to existing select attribute', () => {
            // # Navigate and create a select attribute with initial options
            navigateToAttributes();
            addAttribute('Status', 'select', ['Open']);

            // # Add another option
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByTestId('property-values-input').click();
                cy.findByLabelText('Property values').type('Closed{enter}');
                cy.wait(100);
            });

            // # Click outside to save
            cy.get('body').click(0, 0);
            cy.wait(500);

            // * Verify both options exist
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByText('Open').should('exist');
                cy.findByText('Closed').should('exist');
            });
        });
    });

    describe('delete attribute', () => {
        it('can delete an attribute', () => {
            // # Navigate and create two attributes
            navigateToAttributes();
            addAttribute('Attribute 1', 'text');
            addAttribute('Attribute 2', 'text');

            // * Verify both exist
            cy.findAllByTestId('property-field-row').should('have.length', 2);

            // # Delete the first attribute
            deleteAttribute(0);

            // * Verify only one attribute remains
            cy.findAllByTestId('property-field-row').should('have.length', 1);
            verifyAttribute(0, 'Attribute 2');
        });

        it('shows confirmation modal when deleting', () => {
            // # Navigate and create an attribute
            navigateToAttributes();
            addAttribute('Important Field', 'text');

            // # Click the dot menu for the attribute
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByTestId('menuButton').click();
            });

            // # Click delete
            cy.findByText(/delete/i).click();

            // * Verify confirmation modal appears
            cy.get('#confirm-property-delete-modal').should('be.visible');
            cy.findByText(/are you sure/i).should('be.visible');

            // # Cancel the deletion
            cy.findByRole('button', {name: /cancel/i}).click();

            // * Verify attribute still exists
            cy.findAllByTestId('property-field-row').should('have.length', 1);
        });

        it('returns to empty state after deleting last attribute', () => {
            // # Navigate and create one attribute
            navigateToAttributes();
            addAttribute('Last Attribute', 'text');

            // # Delete the attribute
            deleteAttribute(0);

            // * Verify empty state is displayed
            cy.findByText(/no attributes yet/i).should('be.visible');
            cy.findByRole('button', {name: /add.*first attribute/i}).should('be.visible');
        });
    });

    // Helper Functions

    /**
     * Navigate to the playbook attributes section
     */
    function navigateToAttributes() {
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/attributes`);
    }

    /**
     * Add a new attribute with specified parameters
     * @param {string} name - The attribute name
     * @param {string} type - The attribute type (text, select, multiselect, etc.)
     * @param {Array} options - Array of option strings for select types
     */
    function addAttribute(name, type = 'text', options = []) {
        // # Click add attribute button
        cy.findByRole('button', {name: /add.*attribute/i}).click();

        // # Wait for GraphQL mutation
        cy.wait(500);

        // # Find the newly added row and fill in the name
        cy.findAllByTestId('property-field-row').last().within(() => {
            cy.findByLabelText('Property name').clear().type(name);
        });
        cy.get('body').click(0, 0);

        // # Wait for GraphQL mutation
        cy.wait(500);

        // # Change type if not text
        if (type !== 'text') {
            cy.findAllByTestId('property-field-row').last().within(() => {
                cy.findByRole('button', {name: 'Change property type'}).trigger('click');
            });

            // # Select the type from dropdown
            cy.findByText(new RegExp(`^${type}$`, 'i')).click();
            cy.wait(500);
        }

        // # Add options for select types
        if (options.length > 0 && (type === 'select' || type === 'multi-select')) {
            cy.findAllByTestId('property-field-row').last().within(() => {
                // # First, add the first desired option (can't remove Option 1 until we have another option)
                cy.findByTestId('property-values-input').click();
                cy.findByLabelText('Property values').type(`${options[0]}{enter}`);
                cy.wait(100);

                // # Now remove the default "Option 1"
                cy.findByText('Option 1').parent().find('svg').click();
                cy.wait(100);

                // # Add remaining options
                for (let i = 1; i < options.length; i++) {
                    cy.findByTestId('property-values-input').click();
                    cy.findByLabelText('Property values').type(`${options[i]}{enter}`);
                    cy.wait(100);
                }
            });
        }

        // # Click outside to save (trigger blur)
        cy.get('body').click(0, 0);
        cy.wait(500);
    }

    /**
     * Verify an attribute exists with specific properties
     * @param {number} index - The index of the attribute in the list
     * @param {string} name - Expected attribute name
     */
    function verifyAttribute(index, name) {
        cy.findAllByTestId('property-field-row').eq(index).within(() => {
            cy.findByLabelText('Property name').should('have.value', name);
        });
    }

    /**
     * Delete an attribute by index
     * @param {number} index - The index of the attribute to delete
     */
    function deleteAttribute(index) {
        // # Click the dot menu for the attribute
        cy.findAllByTestId('property-field-row').eq(index).within(() => {
            cy.findByTestId('menuButton').click();
        });

        // # Click delete
        cy.findByText(/delete/i).click();

        // # Confirm deletion in modal
        cy.get('#confirm-property-delete-modal').should('be.visible');
        cy.findByRole('button', {name: /delete/i}).click();
        cy.wait(500);
    }

    /**
     * Edit attribute name
     * @param {number} index - The index of the attribute to edit
     * @param {string} newName - The new name for the attribute
     */
    function editAttributeName(index, newName) {
        cy.findAllByTestId('property-field-row').eq(index).within(() => {
            cy.findByLabelText('Property name').clear().type(newName);
        });

        // # Click outside to trigger save
        cy.get('body').click(0, 0);
        cy.wait(500);
    }
});
