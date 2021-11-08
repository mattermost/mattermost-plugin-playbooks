// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > timeline', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let testTeam;
    let testUser;
    let testPublicPlaybook;
    let runId;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: playbookName,
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

        // # Create a new playbook run
        const now = Date.now();
        const runName = 'Playbook Run (' + now + ')';
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: runName,
            ownerUserId: testUser.id,
        }).then((run) => {
            runId = run.id;
        });
    });

    describe('timeline updates', () => {
        it('can be deleted', () => {
            // # Navigate directly to the retro tab
            cy.visit(`/playbooks/runs/${runId}/retrospective`);

            // * Verify playbook run created message is visible in the timeline
            verifyTimelineEvent('incident_created', 1, 0, `Run started by ${testUser.username}`);

            // * Delete the playbook run created event
            removeTimelineEvent('incident_created', 1, 0, `Run started by ${testUser.username}`);
        });
    });
});

const verifyTimelineEvent = (expectedEventType, expectedNumberOfEvents, expectedEventIndex, expectedEventSummary) => {
    // * Verify we have the expected number of events
    cy.findAllByTestId('timeline-item ' + expectedEventType)
        .should('have.length', expectedNumberOfEvents);

    // * Verify the target event exists with the expected summary text
    cy.findByText(expectedEventSummary).should('exist');
};

const removeTimelineEvent = (expectedEventType, expectedNumberOfEvents, expectedEventIndex, expectedEventSummary) => {
    // * Verify we have the expected number of events
    cy.findAllByTestId('timeline-item ' + expectedEventType)
        .should('have.length', expectedNumberOfEvents);

    // * Verify the target event exists with the expected summary text
    cy.findByText(expectedEventSummary).should('exist');

    // # Hover over the event
    cy.findAllByTestId('timeline-item ' + expectedEventType)
        .eq(expectedEventIndex)
        .trigger('mouseover');

    // # Click the trash
    cy.get('.icon-trash-can-outline').click();

    // * Verify confirm modal is visible
    cy.get('#confirmModal').should('be.visible');

    // # Press the delete entry button
    cy.get('#confirmModalButton').contains('Delete Entry').click();

    // * Verify confirm modal is not visible
    cy.get('#confirmModal').should('not.exist');

    // # Verify we have one fewer event
    cy.findAllByTestId('timeline-item ' + expectedEventType)
        .should('have.length', expectedNumberOfEvents - 1);

    // * Verify the target event does not exist with the expected summary text
    cy.findByText(expectedEventSummary).should('not.exist');
};
