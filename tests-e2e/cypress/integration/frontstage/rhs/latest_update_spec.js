// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('incident rhs > latest update', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let userId;
    let playbookId;

    before(() => {
        // TODO Login as user-1 as soon as updates are posted by the users themselves, not the bot
        // # Login as sysadmin
        cy.apiLogin('sysadmin');

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
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // TODO Login as user-1 as soon as updates are posted by the users themselves, not the bot
        // # Login as sysadmin
        cy.apiLogin('sysadmin');

        // # Create a new incident
        const now = Date.now();
        const incidentName = 'Incident (' + now + ')';
        const incidentChannelName = 'incident-' + now;
        cy.apiStartIncident({
            teamId,
            playbookId,
            incidentName,
            commanderUserId: userId,
        });

        // # Navigate directly to the application and the incident channel
        cy.visit('/ad-1/channels/' + incidentChannelName);
    });

    describe('shows the latest update', () => {
        it('when there is only one', () => {
            const now = Date.now();
            const updateMessage = 'Update - ' + now;

            // # Create a status update
            cy.updateStatus(updateMessage);

            // * Verify that the RHS shows the status update
            cy.get('div[class^=UpdateSection-]').within(() => {
                cy.findByText(updateMessage).should('exist');
            });
        });

        it('when there are more than one', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage);

            const secondMessage = firstMessage + ' - second';

            // # Create a second status update
            cy.updateStatus(secondMessage);

            // * Verify that the RHS shows the second status update
            cy.get('div[class^=UpdateSection-]').within(() => {
                cy.findByText(secondMessage).should('exist');
            });
        });

        it('when the last one was deleted', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage);

            const secondMessage = firstMessage + ' - second';

            // # Create a second status update
            cy.updateStatus(secondMessage).then((postId) => {
                // # Verify that the RHS shows the second status update
                cy.get('div[class^=UpdateSection-]').within(() => {
                    cy.findByText(secondMessage).should('exist');
                });

                // # Delete the second status update
                cy.deletePost(postId);
            });

            // # Verify that the RHS shows the first status update
            cy.get('div[class^=UpdateSection-]').within(() => {
                cy.findByText(firstMessage).should('exist');
            });
        });

        it('when the last one was edited', () => {
            const now = Date.now();
            const updateMessage = 'Update - ' + now;

            // # Create a status update
            cy.updateStatus(updateMessage).then((postId) => {
                const newMessage = updateMessage + ' - edited';

                // # Edit the status update
                cy.editPost(postId, newMessage);

                // * Verify that the RHS shows the new text
                cy.get('div[class^=UpdateSection-]').within(() => {
                    cy.findByText(newMessage).should('exist');
                });
            });
        });
    });

    describe('shows no updates', () => {
        it('in a brand new incident', () => {
            // * Verify that the RHS shows that there are no updates.
            cy.get('#incidentRHSUpdates').contains('No recent updates. Click here to update status.');
        });

        it('when the only update is deleted', () => {
            const now = Date.now();
            const updateMessage = 'Update - ' + now;

            // # Create a status update
            cy.updateStatus(updateMessage).then((postId) => {
                // * Verify that the RHS shows the status update
                cy.get('div[class^=UpdateSection-]').within(() => {
                    cy.findByText(updateMessage).should('exist');
                });

                // # Delete the status update
                cy.deletePost(postId);

                // * Verify that the RHS shows that there are no updates.
                cy.get('#incidentRHSUpdates').contains('No recent updates. Click here to update status.');
            });
        });

        it('when all updates are deleted', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update.
            cy.updateStatus(firstMessage).then((firstId) => {
                // * Verify that the RHS shows the first status update.
                cy.get('div[class^=UpdateSection-]').within(() => {
                    cy.findByText(firstMessage).should('exist');
                });

                const secondMessage = firstMessage + ' - second';

                // # Create a second status update.
                cy.updateStatus(secondMessage).then((secondId) => {
                    // * Verify that the RHS shows the second status update.
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(secondMessage).should('exist');
                    });

                    // # Delete the second status update.
                    cy.deletePost(secondId);

                    // * Verify that the RHS shows the first status update.
                    cy.get('div[class^=UpdateSection-]').within(() => {
                        cy.findByText(firstMessage).should('exist');
                    });

                    // # Delete the first status update.
                    cy.deletePost(firstId);

                    // * Verify that the RHS shows that there are no updates.
                    cy.get('#incidentRHSUpdates').contains('No recent updates. Click here to update status.');
                });
            });
        });
    });
});
