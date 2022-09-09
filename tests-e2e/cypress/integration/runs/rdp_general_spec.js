// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > run details page', () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;
    let testPlaybookRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

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
            playbookRunName: 'the run name',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testPlaybookRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
        });
    });

    it('redirects to not found error if the playbook run is unknown', () => {
        // # Visit the URL of a non-existing playbook run
        cy.visit('/playbooks/runs/an_unknown_id');

        // * Verify that the user has been redirected to the playbook runs not found error page
        cy.url().should('include', '/playbooks/error?type=playbook_runs');
    });

    it('telemetry is triggered', () => {
        // # Intercept all calls to telemetry
        cy.intercept('/plugins/playbooks/api/v0/telemetry').as('telemetry');

        // # Visit the URL of a non-existing playbook run
        cy.visit(`/playbooks/runs/${testPlaybookRun.id}`);

        // * assert  telemetry pageview
        cy.wait('@telemetry').then((interception) => {
            expect(interception.request.body.name).to.eq('run_details');
            expect(interception.request.body.type).to.eq('page');
            expect(interception.request.body.properties.from).to.eq('');
            expect(interception.request.body.properties.role).to.eq('participant');
            expect(interception.request.body.properties.playbookrun_id).to.eq(testPlaybookRun.id);
            expect(interception.request.body.properties.playbook_id).to.eq(testPublicPlaybook.id);
        });
    });
});
