// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > assignee auto-add participant (MM-70073)', {testIsolation: true}, () => {
    let testTeam;
    let testOwner;
    let testParticipant;
    let testTarget;
    let testPlaybook;

    const getChecklistTasks = () => cy.findByTestId('run-checklist-section').findAllByTestId('checkbox-item-container');

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testOwner = user;

            // # Create a non-owner run participant
            cy.apiCreateUser().then(({user: participant}) => {
                testParticipant = participant;
                cy.apiAddUserToTeam(testTeam.id, testParticipant.id);
            });

            // # Create a team member who will be the assignment target — a team member, but
            // not yet a run participant
            cy.apiCreateUser().then(({user: target}) => {
                testTarget = target;
                cy.apiAddUserToTeam(testTeam.id, testTarget.id);
            });

            cy.apiLogin(testOwner);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Assignee Auto-Add Playbook',
                memberIDs: [],
                checklists: [{
                    title: 'Tasks',
                    items: [{title: 'Task'}],
                }],
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering the checklist.
        cy.viewport('macbook-13');
    });

    it('non-owner participant assigning a task to a non-participant adds them as a run participant', () => {
        cy.apiLogin(testOwner);

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Assignee Auto-Add Run ' + Date.now(),
            ownerUserId: testOwner.id,
        }).then((playbookRun) => {
            // # Add testParticipant as a run participant (not the owner)
            cy.apiAddUsersToRun(playbookRun.id, [testParticipant.id]);

            // # Log in as the non-owner participant
            cy.apiLogin(testParticipant);

            cy.intercept('PUT', '**/api/v0/runs/*/checklists/*/item/*/assignee').as('setAssignee');

            // # Visit the run details page as the non-owner participant
            cy.visit(`/playbooks/runs/${playbookRun.id}`);

            // # Assign the task to the non-participant target user via the real UI flow.
            // The assignee-profile-selector testid must be scoped to this checklist item:
            // the RHS Info panel's Owner row renders an identically-testid'd selector that's
            // on screen by default, so an unscoped findByTestId would match two elements.
            getChecklistTasks().eq(0).within(() => {
                cy.findByTestId('hover-menu-edit-button').click();
                cy.findByTestId('assignee-profile-selector').click();
            });
            cy.contains('.playbook-react-select__option', '@' + testTarget.username).click();

            cy.wait('@setAssignee');

            // * The server recorded the assignment
            cy.apiGetPlaybookRun(playbookRun.id).then(({body}) => {
                expect(body.checklists[0].items[0].assignee_id).to.equal(testTarget.id);
            });

            // * The target now appears in the run's Participants list — this is the behavior
            // that was broken before MM-70073: a non-owner participant's assignment used to
            // silently fail to add the target as a participant.
            cy.findByTestId('runinfo-participants').click();
            cy.findByTestId(testTarget.id).should('exist');
        });
    });
});
