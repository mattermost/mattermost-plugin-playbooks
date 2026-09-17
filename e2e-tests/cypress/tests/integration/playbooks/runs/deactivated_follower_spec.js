// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > deactivated user cleanup', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let followerUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a separate user who will follow the run and later be deactivated
            cy.apiCreateUser().then(({user: createdUser}) => {
                followerUser = createdUser;
                cy.apiAddUserToTeam(testTeam.id, followerUser.id);
            });

            // # Login as testUser and create a public playbook
            cy.apiLogin(testUser);
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    // The run details overview lists followers under the "runinfo-following" entry,
    // rendering one avatar (data-testid="profile-option-<username>") per follower.
    const followingEntry = () => cy.findByRole('complementary').findByTestId('runinfo-following');

    // UserHasBeenDeactivated is an asynchronous server-side plugin hook, so the
    // follower may still be present on the first refresh. Reload until the run
    // details page reflects the removal, mirroring a user refreshing the page.
    const refreshUntilFollowerRemoved = (username, attempts = 10) => {
        followingEntry().then((section) => {
            if (section.find(`[data-testid="profile-option-${username}"]`).length === 0) {
                followingEntry().findByTestId(`profile-option-${username}`).should('not.exist');
                return;
            }

            if (attempts <= 1) {
                followingEntry().findByTestId(`profile-option-${username}`).should('not.exist');
                return;
            }

            cy.wait(1000);
            cy.reload();
            refreshUntilFollowerRemoved(username, attempts - 1);
        });
    };

    it('removes a deactivated user from a run follower list on refresh', () => {
        // # Size the viewport so the run details RHS is visible
        cy.viewport('macbook-13');

        // # Session A (testUser) starts a run
        cy.apiLogin(testUser);
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'deactivated follower run',
            ownerUserId: testUser.id,
        }).then((run) => {
            // # A second user follows the run, becoming a follower
            cy.apiLogin(followerUser);
            cy.apiFollowPlaybookRun(run.id);

            // # Session A views the run details page
            cy.apiLogin(testUser);
            cy.visit(`/playbooks/runs/${run.id}`);

            // * The follower is listed in the run's followers before deactivation
            followingEntry().findByTestId(`profile-option-${followerUser.username}`).should('exist');

            // # Session B (admin) deactivates the follower
            cy.apiAdminLogin();
            cy.apiDeactivateUser(followerUser.id);

            // # Session A refreshes the run details page
            cy.apiLogin(testUser);
            cy.reload();

            // * The deactivated user is no longer listed as a follower
            refreshUntilFollowerRemoved(followerUser.username);
        });
    });
});
