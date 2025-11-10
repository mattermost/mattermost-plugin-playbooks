// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {ONE_SEC} from '../../../../fixtures/timeouts';
import * as TIMEOUTS from '../../../../fixtures/timeouts';

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > header', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testViewerUser;
    // eslint-disable-next-line no-unused-vars
    let standaloneRun;
    // eslint-disable-next-line no-unused-vars
    let standaloneRunChannelName;
    let privatePlaybook;
    let privateRun;
    // eslint-disable-next-line no-unused-vars
    let privateRunChannelName;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Create a standalone run without a playbook (channel checklist)
                const now = Date.now();
                const standaloneRunName = 'Standalone Run (' + now + ')';
                standaloneRunChannelName = 'standalone-run-' + now;
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: '', // Empty playbook ID for standalone run
                    playbookRunName: standaloneRunName,
                    ownerUserId: testUser.id,
                }).then((run) => {
                    standaloneRun = run;
                });

                // # Create a second user (viewer) and add to team
                cy.apiCreateUser().then(({user: viewerUser}) => {
                    testViewerUser = viewerUser;
                    cy.apiAddUserToTeam(testTeam.id, testViewerUser.id);

                    // # Create a private playbook with only testUser as member
                    cy.apiCreatePlaybook({
                        teamId: testTeam.id,
                        title: 'Private Playbook',
                        memberIDs: [testUser.id], // Only testUser is a member
                        makePublic: false,
                    }).then((privPlaybook) => {
                        privatePlaybook = privPlaybook;

                        // # Create a run from the private playbook
                        const privateNow = Date.now() + 1000; // Add 1000ms to avoid collision
                        const privateRunName = 'Private Run (' + privateNow + ')';
                        privateRunChannelName = 'private-run-' + privateNow;
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: privatePlaybook.id,
                            playbookRunName: privateRunName,
                            ownerUserId: testUser.id,
                        }).then((run) => {
                            privateRun = run;

                            // # Add viewerUser as participant to the run
                            cy.apiAddUsersToRun(privateRun.id, [testViewerUser.id]);
                        });
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');
    });

    describe('shows name', () => {
        it('of active playbook run', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // * Verify the title is displayed
            cy.get('#rhsContainer').contains(playbookRunName);
        });

        it('of renamed playbook run', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Verify the existing title is displayed
                cy.get('#rhsContainer').contains(playbookRunName);

                // # Rename the channel
                cy.apiPatchChannel(playbookRun.channel_id, {
                    id: playbookRun.channel_id,
                    display_name: 'Updated',
                });

                // * Verify the updated title is displayed
                cy.get('#rhsContainer').contains(playbookRunName);
            });
        });
    });

    describe('edit summary', () => {
        it('by clicking on placeholder', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # click on the field
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').click();

            // # type text in textarea
            cy.get('#rhsContainer').findByTestId('textarea-description').should('be.visible').type('new summary{ctrl+enter}');

            // * make sure the updated summary is here
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');

            // * reload the page
            cy.reload();

            // * make sure the updated summary is still there
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');
        });

        // https://mattermost.atlassian.net/browse/MM-63692
        // eslint-disable-next-line no-only-tests/no-only-tests
        it.skip('by clicking on dot menu item', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # click on the field
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('buttons-row').invoke('show').within(() => {
                    cy.findAllByRole('button').eq(1).click();
                });
            });

            cy.findByTestId('dropdownmenu').within(() => {
                cy.get('span').should('have.length', 3);
                cy.findByText('Edit run summary').click();
            });

            // * Verify textarea is focused
            cy.get('#rhsContainer').findByTestId('textarea-description').should('be.focused').as('textarea');

            // # Type text in textarea
            cy.get('@textarea').type('new summary{ctrl+enter}');

            cy.wait(ONE_SEC);

            // * make sure the updated summary is here
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');
        });
    });

    describe('dot menu navigation', () => {
        // TBD: UI changes for Checklists feature - "Go to run overview" text/navigation has changed
        // eslint-disable-next-line no-only-tests/no-only-tests
        it.skip('hides "Go to playbook" for standalone runs', () => {
            // # Create a standalone run without a playbook (channel checklist)
            const now = Date.now();
            const standaloneRunName = 'Standalone Run (' + now + ')';
            // eslint-disable-next-line no-shadow
            const standaloneRunChannelName = 'standalone-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: '', // Empty playbook ID for standalone run
                playbookRunName: standaloneRunName,
                ownerUserId: testUser.id,
            });

            // # Navigate to the standalone run channel
            cy.visit(`/${testTeam.name}/channels/${standaloneRunChannelName}`);

            // # Wait for the RHS to open
            cy.get('#rhsContainer').should('be.visible');

            // # Click on the dot menu
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('buttons-row').invoke('show').within(() => {
                    cy.findAllByRole('button').eq(1).click({force: true});
                });
            });

            // * Verify "Go to playbook" does not exist
            cy.findByTestId('dropdownmenu').within(() => {
                cy.findByText('Go to playbook').should('not.exist');
                cy.findByText('Go to run overview').should('exist');
            });
        });

        // TBD: UI changes for Checklists feature - "Go to run overview" text/navigation has changed
        // eslint-disable-next-line no-only-tests/no-only-tests
        it.skip('hides "Go to playbook" for private playbooks without access', () => {
            // # Create a second user (viewer)
            cy.apiCreateUser().then(({user: viewerUser}) => {
                cy.apiAddUserToTeam(testTeam.id, viewerUser.id);

                // # Login as the original user and create a private playbook
                cy.apiLogin(testUser);
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Private Playbook',
                    memberIDs: [testUser.id], // Only testUser is a member
                    makePublic: false,
                // eslint-disable-next-line no-shadow
                }).then((privatePlaybook) => {
                    // # Create a run from the private playbook
                    const now = Date.now();
                    const playbookRunName = 'Private Run (' + now + ')';
                    const playbookRunChannelName = 'private-run-' + now;
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: privatePlaybook.id,
                        playbookRunName,
                        ownerUserId: testUser.id,
                    // eslint-disable-next-line no-shadow
                    }).then((privateRun) => {
                        // # Add viewerUser as participant to the run
                        cy.apiAddUsersToRun(privateRun.id, [viewerUser.id]);

                        // # Login as viewer and navigate to the run
                        cy.apiLogin(viewerUser);
                        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                        // # Wait for the RHS to open
                        cy.get('#rhsContainer').should('be.visible');

                        // # Click on the dot menu
                        cy.get('#rhsContainer').within(() => {
                            cy.findByTestId('buttons-row').invoke('show').within(() => {
                                cy.findAllByRole('button').eq(1).click({force: true});
                            });
                        });

                        // * Verify "Go to playbook" does not exist for user without access
                        cy.findByTestId('dropdownmenu').within(() => {
                            cy.findByText('Go to playbook').should('not.exist');
                            cy.findByText('Go to run overview').should('exist');
                        });
                    });
                });
            });
        });
    });

    describe('edit summary of finished run', () => {
        let playbookRunChannelName;
        let finishedPlaybookRun;

        beforeEach(() => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                finishedPlaybookRun = playbookRun;
            });
        });

        it('by clicking on placeholder', () => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # Wait for the RHS to open
            cy.get('#rhsContainer').should('be.visible');

            // # Mark the run as finished
            cy.apiFinishRun(finishedPlaybookRun.id);

            cy.wait(TIMEOUTS.TWO_SEC);

            // # click on the field
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').click();

            // * Verify textarea does not appear
            cy.get('#rhsContainer').findByTestId('textarea-description').should('not.exist');

            // * Verify no prompt to join appears (timeout ensures it fails right away before toast disappears)
            cy.findByText('Become a participant to interact with this run', {timeout: 500}).should('not.exist');
        });

        it('by clicking on dot menu item', () => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # Wait for the RHS to open
            cy.get('#rhsContainer').should('be.visible');

            // # Mark the run as finished
            cy.apiFinishRun(finishedPlaybookRun.id);

            // # click on the field
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('buttons-row').invoke('show').within(() => {
                    cy.findAllByRole('button').eq(1).click({force: true});
                });
            });

            // * Verify the menu items
            cy.findByTestId('dropdownmenu').within(() => {
                cy.get('span').should('have.length', 2);
                cy.findByText('Edit run summary').should('not.exist');
            });

            // * Verify no prompt to join appears (timeout ensures it fails right away before toast disappears)
            cy.findByText('Become a participant to interact with this run', {timeout: 500}).should('not.exist');
        });
    });

    describe('rename checklist', () => {
        // TBD: UI changes for Checklists feature - rename behavior/visibility has changed
        // eslint-disable-next-line no-only-tests/no-only-tests
        it.skip('cannot rename finished checklist from RHS header', () => {
            // # Visit the standalone run channel (channel checklist)
            cy.visit(`/${testTeam.name}/channels/${standaloneRunChannelName}`);

            // # Wait for the page to load
            cy.wait(TIMEOUTS.HALF_SEC);

            // # Finish the checklist
            cy.apiFinishRun(standaloneRun.id);

            // # Reload to get the updated state
            cy.reload();
            cy.wait(TIMEOUTS.ONE_SEC);

            // # Click on the checklist dropdown in the RHS header
            cy.get('[data-testid="checklistDropdown"]').click();

            // * Verify "Rename" option does not exist for finished checklists
            cy.findByTestId('dropdownmenu').within(() => {
                cy.findByText('Rename').should('not.exist');
                cy.findByText('Save as playbook').should('exist');
                cy.findByText('Resume').should('exist');
            });
        });

        // TBD: UI changes for Checklists feature - rename behavior/visibility has changed
        // eslint-disable-next-line no-only-tests/no-only-tests
        it.skip('can rename active checklist from RHS header', () => {
            // # Visit the standalone run channel (channel checklist)
            cy.visit(`/${testTeam.name}/channels/${standaloneRunChannelName}`);

            // # Wait for the page to load
            cy.wait(TIMEOUTS.HALF_SEC);

            // # Click on the checklist dropdown in the RHS header
            cy.get('[data-testid="checklistDropdown"]').click();

            // * Verify "Rename" option exists for active checklists
            cy.findByTestId('dropdownmenu').within(() => {
                cy.findByText('Rename').should('exist');
                cy.findByText('Finish').should('exist');
            });
        });
    });
});
