// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************
import {stubClipboard} from '../../utils';

describe('runs > run details page > header', () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let playbookRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create another user in the same team
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

    const getHeaderIcon = (selector) => {
        return cy.findByTestId('run-header-section').find(selector);
    };

    const getDropdownItemByText = (text) => {
        return cy.findByTestId('run-header-section').findByTestId('dropdownmenu').findByText(text);
    };

    describe('participant', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name',
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                // # Visit the playbook run
                cy.visit(`/playbooks/run_details/${playbookRun.id}`);
            });
        });

        describe('title and icons', () => {
            it('shows the title', () => {
                // * assert title is shown in h1 inside header
                cy.findByTestId('run-header-section').find('h1').contains(playbookRun.name);
            });

            it('shows the in-progress status badge', () => {
                // # assert in progress status badge
                cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');
            });

            it('has a copy-link icon', () => {
                // * Mouseover on the icon
                getHeaderIcon('.icon-link-variant').trigger('mouseover');

                // # Assert tooltip is shown
                cy.get('#copy-run-link-tooltip').should('contain', 'Copy link to run');

                stubClipboard().as('clipboard');
                getHeaderIcon('.icon-link-variant').click().then(() => {
                    // # Verify that tooltip text changed
                    cy.get('#copy-run-link-tooltip').should('contain', 'Copied!');

                    // # Verify clipboard content
                    cy.get('@clipboard').its('contents').should('contain', `/playbooks/run_details/${playbookRun.id}`);
                });
            });

            it('has a go-to-channel icon', () => {
                // * Click on go to channel
                getHeaderIcon('.icon-product-channels').click();

                // # assert we navigated correctly
                cy.url().should('include', `${testTeam.name}/channels/the-run-name`);
            });

            describe('run actions', () => {
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
            });

            describe('trigger: when a status update is posted', () => {
                describe('action: Broadcast update to selected channels', () => {
                    it('shows channel information on first load', () => {
                        // # Open the run actions modal
                        openRunActionsModal();

                        // # Enable broadcast to channels
                        cy.findByText('Broadcast update to selected channels').click();

                        // # Select a couple of channels
                        cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}');

                        // # Save the changes
                        saveRunActionsModal();

                        // # Reload the page, so that the store is not pre-populated when visiting Channels
                        cy.visit(`/playbooks/runs/${playbookRun.id}/overview`);

                        // # Open the run actions modal
                        openRunActionsModal();

                        // * Check that the channels previously added are shown with their full name,
                        // * verifying that the store has been populated by the modal component.
                        cy.findByText('Town Square').should('exist');
                        cy.findByText('Off-Topic').should('exist');
                    });

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
                            playbookRunId: playbookRun.id,
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
                            playbookRunId: playbookRun.id,
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

        describe('context menu', () => {
            it('shows on click', () => {
                // * Click title
                cy.findByTestId('run-header-section').find('h1').click();

                // Assert context menu is opened
                cy.findByTestId('run-header-section').findByTestId('dropdownmenu').should('be.visible');
            });

            it('can copy link', () => {
                stubClipboard().as('clipboard');

                // * Open dropdown
                cy.findByTestId('run-header-section').find('h1').click();

                getDropdownItemByText('Copy link').click().then(() => {
                    // # Verify clipboard content
                    cy.get('@clipboard').its('contents').should('contain', `/playbooks/run_details/${playbookRun.id}`);
                });
            });

            describe('finish run', () => {
                it('can be confirmed', () => {
                    // * Open dropdown
                    cy.findByTestId('run-header-section').find('h1').click();

                    // * Click on finish run
                    getDropdownItemByText('Finish run').click();

                    // # Check that status badge is in-progress
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

                    // # Check that finish run modal is open
                    cy.get('#confirmModal').should('be.visible');
                    cy.get('#confirmModal').find('h1').contains('Confirm finish run');

                    // * Click on confirm
                    cy.get('#confirmModal').get('#confirmModalButton').click();

                    // * Open dropdown
                    cy.findByTestId('run-header-section').find('h1').click();

                    // # Assert option is not anymore in context dropdown
                    getDropdownItemByText('Finish run').should('not.exist');

                    // assert status badge is finished
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');
                });

                it('can be canceled', () => {
                    // * Open dropdown
                    cy.findByTestId('run-header-section').find('h1').click();

                    // * Click on finish run
                    getDropdownItemByText('Finish run').click();

                    // # Check that status badge is in-progress
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

                    // # Check that finish run modal is open
                    cy.get('#confirmModal').should('be.visible');
                    cy.get('#confirmModal').find('h1').contains('Confirm finish run');

                    // * Click on cancel
                    cy.get('#confirmModal').get('#cancelModalButton').click();

                    // * Open dropdown
                    cy.findByTestId('run-header-section').find('h1').click();

                    // # Assert option is not anymore in context dropdown
                    getDropdownItemByText('Finish run').should('be.visible');

                    // assert status badge is still in progress
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');
                });
            });

            describe('run actions', () => {
                it('modal can be opened', () => {
                    // * Open dropdown
                    cy.findByTestId('run-header-section').find('h1').click();

                    // * Click on finish run
                    getDropdownItemByText('Run actions').click();

                    // # assert modal pop up
                    cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');

                    // * Click on cancel
                    cy.findByRole('dialog', {name: /Run Actions/i}).findByTestId('modal-cancel-button').click();

                    // # Assert modal disappeared
                    cy.findByRole('dialog', {name: /Run Actions/i}).should('not.exist');
                });
            });
        });
    });

    describe.skip('viewer', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name',
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                cy.apiLogin(testViewerUser).then(() => {
                    // # Visit the playbook run
                    cy.visit(`/playbooks/run_details/${playbookRun.id}`);
                });
            });
        });

        describe('title and icons', () => {
            it('shows the title', () => {
                // * assert title is shown in h1 inside header
                cy.findByTestId('run-header-section').find('h1').contains(playbookRun.name);
            });

            it('shows the in-progress status badge', () => {
                // # assert in progress status badge
                cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');
            });

            it('has a copy-link icon', () => {
                // * Mouseover on the icon
                getHeaderIcon('.icon-link-variant').trigger('mouseover');

                // # Assert tooltip is shown
                cy.get('#copy-run-link-tooltip').should('contain', 'Copy link to run');

                stubClipboard().as('clipboard');
                getHeaderIcon('.icon-link-variant').click().then(() => {
                    // # Verify that tooltip text changed
                    cy.get('#copy-run-link-tooltip').should('contain', 'Copied!');

                    // # Verify clipboard content
                    cy.get('@clipboard').its('contents').should('contain', `/playbooks/run_details/${playbookRun.id}`);
                });
            });

            it('has a go-to-channel icon', () => {
                // * Click on go to channel
                getHeaderIcon('.icon-product-channels').click();

                // # assert we navigated correctly
                cy.url().should('include', `${testTeam.name}/channels/the-run-name`);
            });

            describe('run actions', () => {
                describe('modal behaviour', () => {
                    it('shows and hides as expected', () => {
                        // should be disabled
                    });
                });
            });
        });

        describe('context menu', () => {
            it('shows on click', () => {
                // * Click title
                cy.findByTestId('run-header-section').find('h1').click();

                // Assert context menu is opened
                cy.findByTestId('run-header-section').findByTestId('dropdownmenu').should('be.visible');
            });

            it('can copy link', () => {
                stubClipboard().as('clipboard');

                // * Open dropdown
                cy.findByTestId('run-header-section').find('h1').click();

                getDropdownItemByText('Copy link').click().then(() => {
                    // # Verify clipboard content
                    cy.get('@clipboard').its('contents').should('contain', `/playbooks/run_details/${playbookRun.id}`);
                });
            });

            describe('finish run', () => {
                it('can be confirmed', () => {
                    // do sth
                });
            });

            describe('run actions', () => {
                it('modal can not be opened', () => {
                    // do sth
                });
            });
        });
    });
});
