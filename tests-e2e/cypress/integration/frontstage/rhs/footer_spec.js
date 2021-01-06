// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe.only('incident rhs > footer', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    const biStagePlaybookName = playbookName + ' - two stages';
    let biStagePlaybookId;
    const triStagePlaybookName = playbookName + ' - three stages';
    let triStagePlaybookId;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                // # Create a playbook
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });

                cy.apiCreatePlaybook({
                    teamId: team.id,
                    title: biStagePlaybookName,
                    checklists: [
                        {
                            title: 'Stage 1',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                        {
                            title: 'Stage 2',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                    ],
                    memberIDs: [userId],
                }).then((playbook) => {
                    biStagePlaybookId = playbook.id;
                });

                cy.apiCreatePlaybook({
                    teamId: team.id,
                    title: triStagePlaybookName,
                    checklists: [
                        {
                            title: 'Stage 1',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                        {
                            title: 'Stage 2',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                        {
                            title: 'Stage 3',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                    ],
                    memberIDs: [userId],
                }).then((playbook) => {
                    triStagePlaybookId = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');
    });

    describe('has navigation button', () => {
        describe('for incidents with one stage', () => {
            beforeEach(() => {
                const now = Date.now();
                const incidentName = 'Incident (' + now + ')';
                const incidentChannelName = 'incident-' + now;

                // # Start the incident
                cy.apiStartIncident({
                    teamId,
                    playbookId,
                    incidentName,
                    commanderUserId: userId,
                });

                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);

                // # Select the tasks tab
                cy.findByTestId('tasks').click();
            });

            it('with "End Incident" and secondary styled when tasks are not finished', () => {
                // * Verify that the button contains End Incident and is secondary styled
                cy.get('#incidentRHSFooter button').contains('End Incident').should('have.css', 'background-color', 'rgba(0, 0, 0, 0)');

                // # Click on the End Incident button
                cy.get('#incidentRHSFooter button').click();

                // * Verify that the interactive dialog is visible
                cy.get('#interactiveDialogModalLabel').contains('Confirm End Incident');
            });

            it('with "End Incident" and primary styled when all tasks are finished', () => {
                // # Check all checkboxes in the stage
                cy.get('.checklist').within(() => {
                    cy.get('.checkbox').each((checkbox) => {
                        cy.wrap(checkbox).click();
                    });
                });

                // # Check that the button contains End Incident and is primary styled
                cy.get('#incidentRHSFooter button').contains('End Incident').should('have.css', 'background-color', 'rgb(22, 109, 224)');

                // # Click on the End Incident button
                cy.get('#incidentRHSFooter button').click();

                // * Verify that the interactive dialog is visible
                cy.get('#interactiveDialogModalLabel').contains('Confirm End Incident');
            });

            it('with "Restart Incident" when the incident is ended', () => {
                // # Click on the End Incident button
                cy.get('#incidentRHSFooter button').click();

                // # Confirm the dialog
                cy.get('#interactiveDialogSubmit').click();

                // * Verify that the button contains Restart Incident
                cy.get('#incidentRHSFooter button').contains('Restart Incident');

                // # Restart the incident
                cy.get('#incidentRHSFooter button').click();

                // * Verify that the incident is ongoing
                cy.get('#rhsContainer').within(() => {
                    cy.get('.sidebar--right__title').contains('Ongoing');
                });

                // * Verify that the button contains End Incident again
                cy.get('#incidentRHSFooter button').contains('End Incident');
            });
        });
    });
});
