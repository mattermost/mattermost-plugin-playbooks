// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************
import {stubClipboard} from '../../utils';

describe('playbooks > overview', () => {
    let testTeam;
    let testUser;
    let testUserFollower;
    let testPublicPlaybook;
    let testPrivateOnlyMinePlaybook;
    let testPrivateSharedPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
            // # Create a dedicated run follower
            cy.apiCreateUser().then(({user: createdUser}) => {
                testUserFollower = createdUser;
                cy.apiAddUserToTeam(testTeam.id, createdUser.id);
            });

            // # Create another user
            cy.apiCreateUser().then(({user: anotherUser}) => {
                // # Login as testUser
                cy.apiLogin(testUser);

                // # Create a public playbook
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Public Playbook',
                    memberIDs: [],
                    retrospectiveTemplate: 'Retro template text',
                    retrospectiveReminderIntervalSeconds: 60 * 60 * 24 * 7 // 7 days
                }).then((playbook) => {
                    testPublicPlaybook = playbook;
                });

                // # Create a private playbook with only the current user
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Private Only Mine Playbook',
                    memberIDs: [testUser.id],
                }).then((playbook) => {
                    testPrivateOnlyMinePlaybook = playbook;
                });

                // # Create a private playbook with multiple users
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Private Shared Playbook',
                    memberIDs: [testUser.id, anotherUser.id],
                }).then((playbook) => {
                    testPrivateSharedPlaybook = playbook;
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('redirects to not found error if the playbook is unknown', () => {
        // # Visit the URL of a non-existing playbook
        cy.visit('/playbooks/playbooks/an_unknown_id');

        // * Verify that the user has been redirected to the playbooks not found error page
        cy.url().should('include', '/playbooks/error?type=playbooks');
    });

    it('should switch to channels and prompt to run when clicking run', () => {
        // # Navigate directly to the playbook
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

        // # Click Run Playbook
        cy.findByTestId('run-playbook').click({force: true});

        // * Verify the playbook run creation dialog has opened
        cy.get('#interactiveDialogModal').should('exist').within(() => {
            cy.findByText('Start run').should('exist');
        });
    });

    it('should copy playbook link', () => {
        // # Navigate directly to the playbook
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

        // # trigger the tooltip
        cy.get('.icon-link-variant').trigger('mouseover', {force: true});

        // * Verify tooltip text
        cy.get('#copy-playbook-link-tooltip').should('contain', 'Copy link to playbook');

        stubClipboard().as('clipboard');

        // # click on copy button
        cy.get('.icon-link-variant').click({force: true}).then(() => {
            // * Verify that tooltip text changed
            cy.get('#copy-playbook-link-tooltip').should('contain', 'Copied!');

            // * Verify clipboard content
            cy.get('@clipboard').its('contents').should('contain', `/playbooks/playbooks/${testPublicPlaybook.id}`);
        });
    });

    it('should duplicate playbook', () => {
        // # Navigate directly to the playbook
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

        // # Click on playbook title
        cy.get('.icon-chevron-down').click();

        // # Click on duplicate
        cy.findByText('Duplicate').click();

        // * Verify that playbook got duplicated
        cy.findByText(`Copy of ${testPublicPlaybook.title}`).should('exist');
    });

    it('shows checklists', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Playbook',
            description: 'Cypress Playbook',
            memberIDs: [],
            checklists: [
                {
                    title: 'Stage 1',
                    items: [
                        {title: 'Step 1'},
                        {title: 'Step 2'},
                    ],
                },
            ],
            retrospectiveTemplate: 'Cypress test template'
        }).then((playbook) => {
            cy.visit(`/playbooks/playbooks/${playbook.id}`);
        });

        cy.findByTestId('preview-content').within(() => {
            // * Verify checklist and associated steps
            cy.findByText('Checklists').next().within(() => {
                cy.findByText('Stage 1').should('exist');
                cy.findByText('Step 1').should('exist');
                cy.findByText('Step 2').should('exist');
            });
        });
    });

    it('show followers in actions preview', () => {
        let playbookId;
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Playbook',
            description: 'Cypress Playbook',
            memberIDs: [testUser.id],
            checklists: [
                {
                    title: 'Stage 1',
                    items: [
                        {title: 'Step 1'},
                        {title: 'Step 2'},
                    ],
                },
            ],
            retrospectiveTemplate: 'Cypress test template'
        }).then((playbook) => {
            playbookId = playbook.id
            cy.visit(`/playbooks/playbooks/${playbook.id}`);

            // * Verify we don't have any follower
            cy.findByTestId('preview-content').within(() => {
                cy.findByText('automatically following this run').should('not.exist');
            });
            // * set myself as follower and check message in preview
            cy.findByTestId('auto-follow-runs').click({force:true});
            cy.findByTestId('preview-content').within(() => {
                cy.findByText('One user automatically following this run').should('exist');
            });

            // # login as other follower and follow playbook
            cy.apiLogin(testUserFollower)
            cy.visit(`/playbooks/playbooks/${playbook.id}`);

            // * set testUserFollower as follower and check message in preview
            cy.findByTestId('auto-follow-runs').click({force:true});
            cy.findByTestId('preview-content').within(() => {
                cy.findByText('2 users automatically following this run').should('exist');
            });

            // * set testUserFollower as no follower and check message in preview
            cy.findByTestId('auto-follow-runs').click({force:true});
            cy.findByTestId('preview-content').within(() => {
                cy.findByText('One user automatically following this run').should('exist');
            });
        });
    })

    it('shows status update timer', () => {
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);
        cy.findByTestId('preview-content').within(() => {
            cy.findByText('Status updates').next().within(() => {
                cy.findByText('1 day').should('exist');
            });
        });
    });

    it('shows correct retrospective timer and template text', () => {
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

        cy.findByTestId('preview-content').within(() => {
            cy.findByText('Retrospective').next().within(() => {
                cy.findByText('7 days').should('exist');
                cy.findByText('Retrospective report template').click();
                cy.findByText('Retro template text').should('exist');
            });
        });
    });

    it('shows statistics in usage tab', () => {
        // # Start playbook run.
        const now = Date.now();
        const playbookRunName = `Run (${now})`;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            // # Go to usage view
            cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}/usage`);

            // * Verify basic information.
            cy.findByText('Runs currently in progress').next().should('contain', '1');
            cy.findByText('Participants currently active').next().should('contain', '1');
            cy.findByText('Runs finished in the last 30 days').next().should('contain', '0');

            // # End the run so those metrics change.
            cy.apiFinishRun(playbookRun.id).then(() => {
                cy.reload();

                // * Verify changes.
                cy.findByText('Runs currently in progress').next().should('contain', '0');
                cy.findByText('Participants currently active').next().should('contain', '0');
                cy.findByText('Runs finished in the last 30 days').next().should('contain', '1');
            });
        });
    });

    describe('archiving', () => {
        const playbookTitle = 'Playbook (' + Date.now() + ')';
        let testPlaybook;

        before(() => {
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: playbookTitle,
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        it('shows intended UI and disallows further updates', () => {
            // # Programmatically archive it
            cy.apiArchivePlaybook(testPlaybook.id);

            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}`);

            // * Verify we're on the right playbook
            cy.get('[class^="Title-"]').contains(playbookTitle);

            // * Verify we can see the archived badge
            cy.findByTestId('archived-badge').should('be.visible');

            // * Verify the run button is disabled
            cy.findByTestId('run-playbook').should('be.disabled');

            // * Verify the edit button is disabled
            cy.findByTestId('edit-playbook').should('be.disabled');

            // # Attempt to edit the playbook
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                // # New title
                playbook.title = 'new Title!!!';

                // * Verify update fails
                cy.apiUpdatePlaybook(playbook, 400);
            });
        });
    });
});
