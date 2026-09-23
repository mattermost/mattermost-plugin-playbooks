// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run details page > finish', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPlaybookRun;
    let testPublicPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user in the same team
            cy.apiCreateUser().then(({user: viewer}) => {
                testViewerUser = viewer;
                cy.apiAddUserToTeam(testTeam.id, testViewerUser.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: 'the run name(' + Date.now() + ')',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testPlaybookRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
        });
    });

    it('is hidden as viewer', () => {
        cy.apiLogin(testViewerUser).then(() => {
            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${testPlaybookRun.id}`);
        });

        // * Assert that finish section does not exist
        cy.findByTestId('run-finish-section').should('not.exist');
    });

    it('is visible', () => {
        // * Verify the finish section is present
        cy.findByTestId('run-finish-section').should('be.visible');
    });

    it('has a placeholder visible', () => {
        // * Verify the placeholder is present
        cy.findByTestId('run-finish-section').contains('Time to wrap up?');
    });

    describe('finish run', () => {
        it('can be confirmed', () => {
            // # Click finish run button
            cy.findByTestId('run-finish-section').find('button').click();

            // * Check that status badge is in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Check that finish run modal is open and has the right title
            cy.get('#confirmModal').should('be.visible');

            // Note: Title can be either "Confirm finish run" or "Confirm finish" depending on context
            cy.get('#confirmModal').find('h1').should('contain', 'Confirm finish');

            // # Click on confirm
            cy.get('#confirmModal').get('#confirmModalButton').click();

            // * Assert finish section is not visible anymore
            cy.findByTestId('run-finish-section').should('not.exist');

            // * Assert status badge is finished
            cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');

            // * Verify run has been removed from LHS
            cy.findByTestId('lhs-navigation').findByText(testPlaybookRun.name).should('not.exist');
        });

        it('can be canceled', () => {
            // # Click on finish run
            cy.findByTestId('run-finish-section').find('button').click();

            // * Check that status badge is in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Check that finish run modal is open
            cy.get('#confirmModal').should('be.visible');

            // Note: Title can be either "Confirm finish run" or "Confirm finish" depending on context
            cy.get('#confirmModal').find('h1').should('contain', 'Confirm finish');

            // # Click on cancel
            cy.get('#confirmModal').get('#cancelModalButton').click();

            // * Check that status badge is still in-progress
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

            // * Check that section is still visible
            cy.findByTestId('run-finish-section').should('be.visible');
        });
    });
});

describe('runs > run details page > finish with conditional hidden tasks', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiAdminLogin();
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.viewport('macbook-13');
        cy.apiLogin(testUser);

        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Finish hidden conditional tasks ' + Date.now(),
            userId: testUser.id,
            checklists: [{
                title: 'Stage 1',
                items: [
                    {title: 'Always visible task'},
                    {title: 'Conditional hidden 1'},
                    {title: 'Conditional hidden 2'},
                    {title: 'Conditional hidden 3'},
                    {title: 'Conditional hidden 4'},
                    {title: 'Conditional hidden 5'},
                ],
            }],
        }).then((playbook) => {
            testPlaybook = playbook;
        });

        cy.then(() => {
            cy.apiAddPropertyField(testPlaybook.id, {
                name: 'Priority',
                type: 'select',
                attrs: {
                    visibility: 'always',
                    sortOrder: 1,
                    options: [
                        {name: 'High'},
                        {name: 'Low'},
                    ],
                },
            });
        });

        cy.then(() => {
            cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                const priorityField = fields.find((f) => f.name === 'Priority');
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: priorityField.id,
                        value: [highOptionId],
                    },
                }).then((condition) => {
                    cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                        for (let i = 1; i <= 5; i++) {
                            playbook.checklists[0].items[i].condition_id = condition.id;
                        }
                        return cy.apiUpdatePlaybook(playbook);
                    });
                });
            });
        });

        cy.then(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'conditional hidden run ' + Date.now(),
                ownerUserId: testUser.id,
            }).then((run) => {
                cy.visit(`/playbooks/runs/${run.id}`);
            });
        });
    });

    it('does not count conditionally hidden tasks as outstanding when finishing', () => {
        cy.findByText('Conditional hidden 1').should('not.exist');

        cy.intercept('PUT', '/plugins/playbooks/api/v0/runs/*/checklists/*/item/*/state').as('setItemState');

        cy.findByText('Always visible task').closest('[data-testid="checkbox-item-container"]').within(() => {
            cy.get('input[type="checkbox"]').check();
        });

        cy.wait('@setItemState').its('response.statusCode').should('eq', 200);

        cy.findByTestId('run-finish-section').find('button').click();

        cy.get('#confirmModal').should('be.visible');
        cy.get('#confirmModal').should('not.contain.text', 'outstanding task');
        cy.get('#confirmModal').should('contain.text', 'Are you sure');
    });

    it('still warns about outstanding tasks when a visible task is not complete', () => {
        cy.findByText('Conditional hidden 1').should('not.exist');

        cy.findByText('Always visible task').should('be.visible');

        cy.findByTestId('run-finish-section').find('button').click();

        cy.get('#confirmModal').should('be.visible');
        cy.get('#confirmModal').should('contain.text', 'outstanding task');
    });
});
