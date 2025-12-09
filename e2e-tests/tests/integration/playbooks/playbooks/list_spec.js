// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > list', {testIsolation: true}, () => {
    const playbookTitle = 'The Playbook Name';
    let testTeam;
    let testUser;
    let testUser2;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create another user in the same team
            cy.apiCreateUser().then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
            });

            // # Login as user-1
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: playbookTitle,
                memberIDs: [],
            });

            // # Create an archived public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook archived',
                memberIDs: [],
            }).then(({id}) => cy.apiArchivePlaybook(id));
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('has "Playbooks" in heading', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybook').should('exist').contains('Playbooks');
    });

    it('join/leave playbook', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu
        cy.findByTestId('menuButtonActions').click();

        // # Click on leave
        cy.findByText('Leave').click();

        // * Verify it has disappeared from the LHS
        cy.findByTestId('lhs-navigation').findByText(playbookTitle).should('not.exist');

        // # Join a playbook
        cy.findByTestId('join-playbook').click();

        // * Verify it has appeared in LHS
        cy.findByTestId('lhs-navigation').findByText(playbookTitle).should('exist');
    });

    it('can duplicate playbook', () => {
        // # Login as testUser2
        cy.apiLogin(testUser2);

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu
        cy.findByTestId('menuButtonActions').click();

        // # Click on duplicate
        cy.findByText('Duplicate').click();

        // * Verify that playbook got duplicated
        cy.findByText('Copy of ' + playbookTitle).should('exist');

        // * Verify that the current user is a member and can run the playbook.
        cy.findByText('Copy of ' + playbookTitle).closest('[data-testid="playbook-item"]').within(() => {
            cy.findByTestId('run-playbook').should('exist');
            cy.findByTestId('join-playbook').should('not.exist');
        });

        // * Verify that the duplicated playbook is shown in the LHS
        cy.findByTestId('Playbooks').within(() => {
            cy.findByText('Copy of ' + playbookTitle).should('be.visible');
        });
    });

    it.only('can duplicate playbook with attributes and conditions', () => {
        let playbookWithAttrs;
        let priorityField;
        let statusField;

        // # Create a playbook with attributes and conditions
        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Playbook with Attributes',
            userId: testUser.id,
        }).then((playbook) => {
            playbookWithAttrs = playbook;

            // # Add a text attribute
            cy.apiAddPropertyField(playbook.id, {
                name: 'Customer Name',
                type: 'text',
                attrs: {
                    visibility: 'always',
                    sortOrder: 0,
                },
            });

            // # Add a select attribute with options
            cy.apiAddPropertyField(playbook.id, {
                name: 'Priority',
                type: 'select',
                attrs: {
                    visibility: 'always',
                    sortOrder: 1,
                    options: [
                        {name: 'High'},
                        {name: 'Medium'},
                        {name: 'Low'},
                    ],
                },
            });

            // # Add another select attribute
            cy.apiAddPropertyField(playbook.id, {
                name: 'Status',
                type: 'select',
                attrs: {
                    visibility: 'when_set',
                    sortOrder: 2,
                    options: [
                        {name: 'Active'},
                        {name: 'Pending'},
                    ],
                },
            });

            // # Get the property fields to use in condition
            cy.apiGetPropertyFields(playbook.id).then((fields) => {
                priorityField = fields.find((f) => f.name === 'Priority');
                statusField = fields.find((f) => f.name === 'Status');

                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;
                const activeOptionId = statusField.attrs.options.find((o) => o.name === 'Active').id;

                // # Create a condition with AND logic
                cy.apiCreatePlaybookCondition(playbook.id, {
                    and: [
                        {is: {field_id: priorityField.id, value: [highOptionId]}},
                        {is: {field_id: statusField.id, value: [activeOptionId]}},
                    ],
                }).then((condition) => {
                    // # Attach condition to first task
                    cy.apiAttachConditionToTask(playbook.id, 0, 0, condition.id);
                });
            });
        });

        // # Login as testUser
        cy.apiLogin(testUser);

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu of the playbook with attributes
        cy.contains('[data-testid="playbook-item"]', 'Playbook with Attributes').within(() => {
            cy.findByTestId('menuButtonActions').click();
        });

        // # Click on duplicate
        cy.findByText('Duplicate').click();

        // * Verify that playbook got duplicated
        cy.findByText('Copy of Playbook with Attributes', {timeout: 10000}).should('exist');

        // # Click on the duplicated playbook to open it
        cy.findByText('Copy of Playbook with Attributes').click();

        // # Navigate to attributes section
        cy.findByText('Attributes').click();

        // * Verify all attributes were copied
        cy.findAllByTestId('property-field-row').should('have.length', 3);

        // * Verify text attribute
        verifyAttributeInList(0, 'Customer Name');

        // * Verify select attribute with options
        verifyAttributeInList(1, 'Priority');
        cy.findAllByTestId('property-field-row').eq(1).within(() => {
            cy.findByText('High').should('exist');
            cy.findByText('Medium').should('exist');
            cy.findByText('Low').should('exist');
        });

        // * Verify second select attribute with options
        verifyAttributeInList(2, 'Status');
        cy.findAllByTestId('property-field-row').eq(2).within(() => {
            cy.findByText('Active').should('exist');
            cy.findByText('Pending').should('exist');
        });

        // # Modify the duplicated playbook to test independence
        // # Rename the first attribute
        cy.findAllByTestId('property-field-row').eq(0).within(() => {
            cy.findByLabelText('Attribute name').clear().type('Modified Name');
        });

        // # Click outside to save
        cy.get('body').click(0, 0);
        cy.wait(500);

        // * Verify the change was saved
        verifyAttributeInList(0, 'Modified Name');

        // # Navigate to outline section to verify conditions
        cy.findByText('Outline').click();

        // * Verify condition was copied
        cy.findByTestId('condition-header').should('exist');
        cy.findByTestId('condition-header').within(() => {
            cy.findByText('Priority').should('exist');
            cy.findByText('Status').should('exist');
            cy.findByText(/\band\b/i).should('exist');
        });

        // # Modify the condition to test independence
        // # Click edit button
        cy.findByTestId('condition-header-edit-button').click();
        cy.wait(500);

        // # Change AND to OR
        cy.contains('.condition-select__single-value', 'AND').click();
        cy.get('.condition-select__menu').contains('OR').click();
        cy.wait(500);

        // # Click save button
        cy.findByRole('button', {name: /save condition changes/i}).click();
        cy.wait(500);

        // * Verify the change was saved
        cy.findByTestId('condition-header').within(() => {
            cy.findByText(/\bor\b/i).should('exist');
        });

        // # Navigate back to playbooks list
        cy.findByTestId('playbooksLHSButton').click();

        // # Open the original playbook (wait for it to be visible)
        cy.findByText('Playbook with Attributes', {timeout: 10000}).should('be.visible').click();

        // # Navigate to attributes section
        cy.findByText('Attributes').click();

        // * Verify original playbook still has its attributes unchanged
        cy.findAllByTestId('property-field-row').should('have.length', 3);

        // * Verify the first attribute still has the original name (not "Modified Name")
        verifyAttributeInList(0, 'Customer Name');

        // # Navigate to outline section
        cy.findByText('Outline').click();

        // * Verify original playbook still has its condition with AND (not OR)
        cy.findByTestId('condition-header').should('exist');
        cy.findByTestId('condition-header').within(() => {
            cy.findByText(/\band\b/i).should('exist');
            cy.findByText(/\bor\b/i).should('not.exist');
        });
    });

    context('archived playbooks', () => {
        it('does not show them by default', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // * Assert the archived playbook is not there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(2);
            });
        });
        it('shows them upon click on the filter', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // # Click the With Archived button
            cy.findByTestId('with-archived').click();

            // * Assert the archived playbook is there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(3);
            });
        });
    });

    describe('can import playbook', () => {
        let validPlaybookExport;
        let invalidTypePlaybookExport;

        const bufferToCypressFile = (fileName, fileData, fileType) => ({
            fileName,
            contents: fileData,
            mimeType: fileType,
        });

        before(() => {
            // # Load fixtures and convert to File
            cy.fixture('playbook-export.json', null).then((buffer) => {
                validPlaybookExport = bufferToCypressFile('export.json', buffer, 'application/json');
            });
            cy.fixture('mp3-audio-file.mp3', null).then((buffer) => {
                invalidTypePlaybookExport = bufferToCypressFile('audio.mp3', buffer, 'audio/mpeg');
            });
        });

        it('triggered by drag and drop', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // # Drop loaded fixture onto playbook list
            cy.findByTestId('playbook-list-scroll-container').selectFile(validPlaybookExport, {
                action: 'drag-drop',
            });

            // * Verify that a new playbook was created.
            cy.findByTestId('playbook-editor-title').should('contain', 'Example Playbook');
        });

        it('triggered by using button/input', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            cy.findByTestId('titlePlaybook').within(() => {
                // # Select loaded fixture for upload
                cy.findByTestId('playbook-import-input').selectFile(validPlaybookExport, {force: true});
            });

            // * Verify that a new playbook was created.
            cy.findByTestId('playbook-editor-title').should('contain', 'Example Playbook');
        });

        it('fails to import invalid file type', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            cy.findByTestId('titlePlaybook').within(() => {
                // # Select loaded fixture for upload
                cy.findByTestId('playbook-import-input').selectFile(invalidTypePlaybookExport, {force: true});
            });

            // * Verify that an error message is displayed.
            cy.findByText('The file must be a valid JSON playbook template.').should('be.visible');
        });
    });

    function verifyAttributeInList(index, name) {
        cy.findAllByTestId('property-field-row').eq(index).within(() => {
            cy.findByLabelText('Attribute name').should('have.value', name);
        });
    }
});
