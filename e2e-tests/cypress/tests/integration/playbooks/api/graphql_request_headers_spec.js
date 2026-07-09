// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('api > graphql_request_headers', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a public playbook to run
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
        // # Size the viewport so the run details page renders fully.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    // Regression for MM-69322: Apollo's HttpLink set a lowercase `content-type` that
    // collided with the capitalized `Content-Type` added by Client4.getOptions, so the
    // request went out as `Content-Type: application/json, application/json` and tripped
    // WAF rules that flag multiple Content-Type headers. The endpoint must send one value.
    it('sends a single Content-Type header on the browser GraphQL /query request', () => {
        // # Capture the browser-issued GraphQL request (this is the Apollo path; cy.request
        // # would bypass it and cannot reproduce the bug).
        cy.intercept('POST', '**/plugins/playbooks/api/v0/query').as('graphqlQuery');

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: 'graphql header run',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            // # Visit a GraphQL-backed page so the browser issues a /query through Apollo
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);
        });

        // * The request must carry exactly one Content-Type value, not a duplicated pair
        cy.wait('@graphqlQuery').then(({request}) => {
            expect(request.headers['content-type']).to.equal('application/json');
        });
    });
});
