// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs > stages', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    const noStagePlaybookName = playbookName + ' - no stages';
    let noStagePlaybookId;
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

                cy.apiCreatePlaybook({
                    teamId: team.id,
                    title: noStagePlaybookName,
                    checklists: [],
                    memberIDs: [userId],
                }).then((playbook) => {
                    noStagePlaybookId = playbook.id;
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin('user-1');
    });

    describe('shows information for incidents with more than one stage', () => {
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
        });

        it('containing current information in summary view', () => {
            // * Verify that the stage information is visible
            cy.get('#incidentRHSStages').within(() => {
                cy.get('.title').contains('Current Stage');
                cy.get('div').contains('Stage 1');
                cy.get('span').contains('(1/3)');
            });
        });

        it('containing current information in tasks view', () => {
            // # Select the tasks tab
            cy.findByTestId('tasks').click();

            // * Verify that the stage information is visible
            cy.get('#incidentRHSStages').within(() => {
                cy.get('.title').contains('Current Stage');
                cy.get('div').contains('Stage 1');
                cy.get('span').contains('(1/3)');
            });
        });

        it('updating when stage changes', () => {
            // # Select the tasks tab
            cy.findByTestId('tasks').click();

            // # Check all checkboxes in the stage
            cy.get('.checklist').within(() => {
                cy.get('.checkbox').each((checkbox) => {
                    cy.wrap(checkbox).click();
                });
            });

            // # Click on the Next Stage button
            cy.get('#incidentRHSFooter button').click();

            // * Verify that the stage information has updated in tasks tab
            cy.get('#incidentRHSStages').within(() => {
                cy.get('.title').contains('Current Stage');
                cy.get('div').contains('Stage 2');
                cy.get('span').contains('(2/3)');
            });

            // # Select the summary tab
            cy.findByTestId('summary').click();

            // * Verify that the stage information has updated in summary tab
            cy.get('#incidentRHSStages').within(() => {
                cy.get('.title').contains('Current Stage');
                cy.get('div').contains('Stage 2');
                cy.get('span').contains('(2/3)');
            });
        });
    });

    describe('does not show information', () => {
        it('for an incident with no stages', () => {
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;

            // # Start the incident
            cy.apiStartIncident({
                teamId,
                noStagePlaybookId,
                incidentName,
                commanderUserId: userId,
            });

            // # Navigate directly to the application and the incident channel
            cy.visit('/ad-1/channels/' + incidentChannelName);

            // # Wait for the RHS to open.
            cy.get('#rhsContainer').should('be.visible');

            // * Verify that the stage information is not visible in summary tab
            cy.get('#incidentRHSStages').should('not.exist');

            // # Select the tasks tab
            cy.findByTestId('tasks').click();

            // * Verify that the stage information is not visible in tasks tab
            cy.get('#incidentRHSStages').should('not.exist');
        });

        it('for an incident with one single stage', () => {
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

            // # Wait for the RHS to open.
            cy.get('#rhsContainer').should('be.visible');

            // * Verify that the stage information is not visible in summary tab
            cy.get('#incidentRHSStages').should('not.exist');

            // # Select the tasks tab
            cy.findByTestId('tasks').click();

            // * Verify that the stage information is not visible in tasks tab
            cy.get('#incidentRHSStages').should('not.exist');
        });
    });
});
