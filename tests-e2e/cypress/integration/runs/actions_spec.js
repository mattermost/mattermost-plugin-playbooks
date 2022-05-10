// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > actions', () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let testPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup({promoteNewUserAsAdmin: true}).then(({team, user}) => {
            testTeam = team;
            testSysadmin = user;

            cy.apiCreateUser().then((resp) => {
                testUser = resp.user;
                cy.apiAddUserToTeam(team.id, resp.user.id);
            });

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        const now = Date.now()
        const runName = 'Playbook Run ' + now;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: runName,
            ownerUserId: testSysadmin.id,
        }).then((run) => {
            testRun = run;

            // # Navigate to the run page
            cy.visit(`/${testTeam.name}/channels/playbook-run-${now}`);
            cy.findByRole('button', {name: /Run details/i}).click({force: true});
        });
    });

    afterEach(() => {
        // # Ensure apiInitSetup() can run again
        cy.apiLogin(testSysadmin);
    });

    const openRunActionsModal = () => {
        // # Click on the run actions modal button
        cy.findByRole('button', {name: /Run Actions/i}).click({force: true});

        // * Verify that the modal is shown
        cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');
    };

    const saveRunActionsModal = () => {
        // # Click on the Save button without changing anything
        cy.findByRole('button', {name: /Save/i}).click();

        // * Verify that the modal is no longer there
        cy.findByRole('dialog', {name: /Run Actions/i}).should('not.exist');
    };

    describe('modal behaviour', () => {
        it('shows and hides as expected', () => {
            // * Verify that the run actions modal is shown when clicking on the button
            openRunActionsModal();

            // # Click on the Cancel button
            cy.findByRole('button', {name: /Cancel/i}).click();

            // * Verify that the modal is no longer there
            cy.findByRole('dialog', {name: /Run Actions/i}).should('not.exist');

            // # Open the run actions modal
            openRunActionsModal();

            // * Verify that saving the modal hides it
            saveRunActionsModal();
        });

        it('honours the settings from the playbook', () => {
            cy.apiCreateChannel(
                testTeam.id,
                'action-channel',
                'Action Channel',
                'O'
            ).then(({channel}) => {
                // # Create a different playbook with both settings enabled and populated with data,
                // # and then start a run from it
                const broadcastChannelIds = [channel.id];
                const webhookOnStatusUpdateURLs = ['https://one.com', 'https://two.com'];
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Playbook' + Date.now(),
                    broadcastEnabled: true,
                    broadcastChannelIds,
                    webhookOnStatusUpdateEnabled: true,
                    webhookOnStatusUpdateURLs,
                }).then((playbook) => {
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'Run with actions preconfigured',
                        ownerUserId: testUser.id,
                    });
                });

                // # Navigate to the run page
                cy.visit(`/${testTeam.name}/channels/run-with-actions-preconfigured`);
                cy.findByRole('button', {name: /Run details/i}).click({force: true});

                // # Open the run actions modal
                openRunActionsModal();

                // * Verify that the broadcast-to-channels toggle is checked
                cy.findByText('Broadcast update to selected channels').parent().within(() => {
                    cy.get('input').should('be.checked');
                });

                // * Verify that the channel is in the selector
                cy.findByText(channel.display_name);

                // * Verify that the send-webhooks toggle is checked
                cy.findByText('Send outgoing webhook').parent().within(() => {
                    cy.get('input').should('be.checked');
                });
            });
        });
    });

    describe('trigger: when a status update is posted', () => {
        describe('action: Broadcast update to selected channels', () => {
            it('broadcasts to two channels configured when it is enabled', () => {
                // # Open the run actions modal
                openRunActionsModal();

                // # Enable broadcast to channels
                cy.findByText('Broadcast update to selected channels').click();

                // # Select a couple of channels
                cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}');

                // # Save the changes
                saveRunActionsModal();

                // # Post a status update, with a reminder in 1 second.
                const message = 'Status update - ' + Date.now();
                cy.apiUpdateStatus({
                    playbookRunId: testRun.id,
                    message,
                });

                // # Navigate to the town square channel
                cy.visit(`/${testTeam.name}/channels/town-square`);

                // * Verify that the last post contains the status update
                cy.getLastPost().then((post) => {
                    cy.get(post).contains(message);
                });

                // # Navigate to the off-topic channel
                cy.visit(`/${testTeam.name}/channels/off-topic`);

                // * Verify that the last post contains the status update
                cy.getLastPost().then((post) => {
                    cy.get(post).contains(message);
                });
            });

            it('does not broadcast if it is disabled, even if there are channels configured', () => {
                // # Open the run actions modal
                openRunActionsModal();

                // # Enable broadcast to channels
                cy.findByText('Broadcast update to selected channels').click();

                // # Select a couple of channels
                cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}');

                // # Disable broadcast to channels
                cy.findByText('Broadcast update to selected channels').click();

                // # Save the changes
                saveRunActionsModal();

                // # Post a status update, with a reminder in 1 second.
                const message = 'Status update - ' + Date.now();
                cy.apiUpdateStatus({
                    playbookRunId: testRun.id,
                    message,
                });

                // # Navigate to the town square channel
                cy.visit(`/${testTeam.name}/channels/town-square`);

                // * Verify that the last post does not contain the status update
                cy.getLastPost().then((post) => {
                    cy.get(post).contains(message).should('not.exist');
                });

                // # Navigate to the off-topic channel
                cy.visit(`/${testTeam.name}/channels/off-topic`);

                // * Verify that the last post does not contain the status update
                cy.getLastPost().then((post) => {
                    cy.get(post).contains(message).should('not.exist');
                });
            });
        });
    });
});
