// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs > footer', () => {
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

    describe('has three dots button', () => {
        describe('for incidents with more than one stage', () => {
            beforeEach(() => {
                const now = Date.now();
                const incidentName = 'Incident (' + now + ')';
                const incidentChannelName = 'incident-' + now;

                // # Start the incident
                cy.apiStartIncident({
                    teamId,
                    playbookId: triStagePlaybookId,
                    incidentName,
                    commanderUserId: userId,
                });

                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);

                // # Select the tasks tab
                cy.findByTestId('tasks').click();
            });

            it('with only "End Incident" when in the first stage', () => {
                // # Click on the three dots button
                cy.get('#incidentRHSFooter .icon-dots-vertical').click();

                // * Verify that the menu does not contain Previous Stage
                cy.get('[class^=DropdownMenu]').should('not.contain', 'Previous Stage');

                // * Verify that the menu does contain End Incident
                cy.get('[class^=DropdownMenu]').contains('End Incident');

                // # Click on End Incident
                cy.get('[class^=DropdownMenu]').contains('End Incident').click();

                // * Verify that the interactive dialog is visible
                cy.get('#interactiveDialogModalLabel').contains('Confirm End Incident');
            });

            describe('that are in a middle stage', () => {
                beforeEach(() => {
                    // # Check all checkboxes in the stage
                    cy.get('.checklist').within(() => {
                        cy.get('.checkbox').each((checkbox) => {
                            cy.wrap(checkbox).click();
                        });
                    });

                    // # Go to second stage
                    cy.get('#incidentRHSFooter button').click();

                    // * Verify that we're on second stage
                    cy.get('#incidentRHSStages').within(() => {
                        cy.get('span').contains('(2/3)');
                    });

                    // # Click on the three dots button
                    cy.get('#incidentRHSFooter .icon-dots-vertical').click();
                });

                it('with "Previous Stage" button', () => {
                    // * Verify that the menu does contain Previous Stage
                    cy.get('[class^=DropdownMenu]').contains('Previous Stage');

                    // # Click on Previous Stage
                    cy.get('[class^=DropdownMenu]').contains('Previous Stage').click();

                    // * Verify that the stage information has updated
                    cy.get('#incidentRHSStages').within(() => {
                        cy.get('span').contains('(1/3)');
                    });
                });

                it('with End Incident button', () => {
                    // * Verify that the menu does contain End Incident
                    cy.get('[class^=DropdownMenu]').contains('End Incident');

                    // # Click on End Incident
                    cy.get('[class^=DropdownMenu]').contains('End Incident').click();

                    // * Verify that the interactive dialog is visible
                    cy.get('#interactiveDialogModalLabel').contains('Confirm End Incident');
                });
            });

            it('with only Previous Stage when in the last stage', () => {
                // # Go to last stage
                for (let i = 0; i < 2; i++) {
                    // # Check all checkboxes in the stage
                    cy.get('.checklist').within(() => {
                        cy.get('.checkbox').each((checkbox) => {
                            cy.wrap(checkbox).click();
                        });
                    });

                    // # Go to next stage
                    cy.get('#incidentRHSFooter button').click();
                }

                // # Click on the three dots button
                cy.get('#incidentRHSFooter .icon-dots-vertical').click();

                // * Verify that the menu does contain Previous Stage
                cy.get('[class^=DropdownMenu]').contains('Previous Stage');

                // # Click on Previous Stage
                cy.get('[class^=DropdownMenu]').contains('Previous Stage').click();

                // * Verify that the stage information has updated
                cy.get('#incidentRHSStages').within(() => {
                    cy.get('span').contains('(2/3)');
                });

                // * Verify that the menu does not contain End Incident
                cy.get('[class^=DropdownMenu]').should('not.contain', 'End Incident');
            });
        });

        it('except for an incident with one single stage', () => {
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

            // # Check that the three dots button is not visible
            cy.get('#incidentRHSFooter > .icon-dots-vertical').should('not.exist');
        });
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

        describe('for incidents with more than one stage in the last stage', () => {
            beforeEach(() => {
                const now = Date.now();
                const incidentName = 'Incident (' + now + ')';
                const incidentChannelName = 'incident-' + now;

                // # Start the incident
                cy.apiStartIncident({
                    teamId,
                    playbookId: biStagePlaybookId,
                    incidentName,
                    commanderUserId: userId,
                });

                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);

                // # Select the tasks tab
                cy.findByTestId('tasks').click();

                // # Go to the last stage
                cy.executeSlashCommand('/incident stage next');
                cy.get('#interactiveDialogSubmit').click();
            });

            it('with "End Incident" secondary styled when tasks are not finished', () => {
                // # Check that the button contains End Incident and is secondary styled
                cy.get('#incidentRHSFooter button').contains('End Incident').should('have.css', 'background-color', 'rgba(0, 0, 0, 0)');

                // # Click on the End Incident button
                cy.get('#incidentRHSFooter button').click();

                // * Verify that the interactive dialog is visible
                cy.get('#interactiveDialogModalLabel').contains('Confirm End Incident');
            });

            it('with "End Incident" primary styled when all tasks are finished', () => {
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
        });

        describe('for incidents not in the last stage', () => {
            beforeEach(() => {
                const now = Date.now();
                const incidentName = 'Incident (' + now + ')';
                const incidentChannelName = 'incident-' + now;

                // # Start the incident
                cy.apiStartIncident({
                    teamId,
                    playbookId: biStagePlaybookId,
                    incidentName,
                    commanderUserId: userId,
                });

                // # Navigate directly to the application and the incident channel
                cy.visit('/ad-1/channels/' + incidentChannelName);

                // # Select the tasks tab
                cy.findByTestId('tasks').click();
            });

            it('with "Next Stage" and secondary styled when tasks are not finished', () => {
                // # Check that the button contains Next Stage and is secondary styled
                cy.get('#incidentRHSFooter button').contains('Next Stage').should('have.css', 'background-color', 'rgba(0, 0, 0, 0)');

                // * Verify that we're on the first stage
                cy.get('#incidentRHSStages').within(() => {
                    cy.get('div').contains('Stage 1');
                    cy.get('span').contains('(1/2)');
                });

                // # Click on the Next Stage button
                cy.get('#incidentRHSFooter button').click();

                // * Verify that the interactive dialog is visible
                cy.get('#interactiveDialogModalLabel').contains('Not all tasks in this stage are complete.');

                // # Confirm the dialog
                cy.get('#interactiveDialogSubmit').click();

                // * Verify that we're on the second stage
                cy.get('#incidentRHSStages').within(() => {
                    cy.get('div').contains('Stage 2');
                    cy.get('span').contains('(2/2)');
                });
            });

            it('with "Next Stage" and primary styled when all tasks are finished', () => {
                // # Check all checkboxes in the stage
                cy.get('.checklist').within(() => {
                    cy.get('.checkbox').each((checkbox) => {
                        cy.wrap(checkbox).click();
                    });
                });

                // # Check that the button contains Next Stage and is primary styled
                cy.get('#incidentRHSFooter button').contains('Next Stage').should('have.css', 'background-color', 'rgb(22, 109, 224)');

                // * Verify that we're on the first stage
                cy.get('#incidentRHSStages').within(() => {
                    cy.get('div').contains('Stage 1');
                    cy.get('span').contains('(1/2)');
                });

                // # Click on the Next Stage button
                cy.get('#incidentRHSFooter button').click();

                // * Verify that there is no interactive dialog showing up
                cy.get('#interactiveDialogModalLabel').should('not.exist');

                // * Verify that we're on the second stage
                cy.get('#incidentRHSStages').within(() => {
                    cy.get('div').contains('Stage 2');
                    cy.get('span').contains('(2/2)');
                });
            });
        });
    });
});
