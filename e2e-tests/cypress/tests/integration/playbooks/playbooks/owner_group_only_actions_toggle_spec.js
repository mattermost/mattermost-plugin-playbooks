// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('playbooks > owner_group_only_actions toggle', {testIsolation: true}, () => {
    let testTeam;
    let testAdmin;
    let midRunPlaybook;
    let midRunRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testAdmin = user;
        });
    });

    beforeEach(() => {
        cy.viewport('macbook-13');
        cy.apiLogin(testAdmin);
    });

    afterEach(() => {
        cy.apiAdminLogin();
        if (midRunRun) {
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: `/plugins/playbooks/api/v0/runs/${midRunRun.id}/finish`,
                method: 'PUT',
                failOnStatusCode: false,
            });
            midRunRun = null;
        }
        if (midRunPlaybook) {
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: `/plugins/playbooks/api/v0/playbooks/${midRunPlaybook.id}`,
                method: 'DELETE',
                failOnStatusCode: false,
            });
            midRunPlaybook = null;
        }
    });

    it('persists the enabled state after a page reload', () => {
        // # Create playbook (default: owner_group_only_actions = false)
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Toggle Persistence Playbook ' + getRandomId(),
            memberIDs: [],
            makePublic: true,
        }).then((playbook) => {
            midRunPlaybook = playbook;

            // # Open the outline editor
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            // * Toggle starts unchecked
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('not.be.checked');

            // # Intercept the persistence request so we can wait for it
            cy.intercept('PUT', `**/api/v0/playbooks/${playbook.id}`).as('persistToggle');

            // # Enable the toggle (fires confirmation modal for false→true)
            cy.playbooksToggleWithConfirmation('owner-group-only-actions-toggle');

            // * Toggle reflects the new state immediately
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('be.checked');

            // # Wait for the server to persist before reloading
            cy.wait('@persistToggle').its('response.statusCode').should('be.oneOf', [200, 204]);

            // # Reload the page — state should come from the server, not memory
            cy.reload();

            // * Toggle remains checked after reload
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('be.checked');
        });
    });

    it('persists the disabled state after a page reload', () => {
        // # Create playbook and enable the flag via API so we can test the reverse flip
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Toggle Disable Playbook ' + getRandomId(),
            memberIDs: [],
            makePublic: true,
        }).then((playbook) => {
            midRunPlaybook = playbook;

            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            cy.intercept('PUT', `**/api/v0/playbooks/${playbook.id}`).as('persistEnable');
            cy.playbooksToggleWithConfirmation('owner-group-only-actions-toggle');
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('be.checked');
            cy.wait('@persistEnable').its('response.statusCode').should('be.oneOf', [200, 204]);

            // # Disable: true→false does not require confirmation
            cy.intercept('PUT', `**/api/v0/playbooks/${playbook.id}`).as('persistDisable');
            cy.findByTestId('owner-group-only-actions-toggle').find('label').click();

            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('not.be.checked');

            cy.wait('@persistDisable').its('response.statusCode').should('be.oneOf', [200, 204]);

            // # Reload
            cy.reload();

            // * Toggle remains unchecked after reload
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('not.be.checked');
        });
    });

    it('toggle is not visible to non-admin playbook members', () => {
        cy.apiCreateAndAddUserToTeam(testTeam.id).then((regularMember) => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Non-Admin Visibility Playbook ' + getRandomId(),
                memberIDs: [],
                makePublic: true,
            }).then((playbook) => {
                midRunPlaybook = playbook;

                // # Add regularMember as a non-admin member of the playbook (no playbook_admin role)
                cy.apiGetPlaybook(playbook.id).then((pb) => {
                    cy.apiUpdatePlaybook({
                        ...pb,
                        members: [
                            ...pb.members,
                            {user_id: regularMember.id, roles: ['playbook_member']},
                        ],
                    });
                });

                // # Login as the non-admin member and visit the outline
                cy.apiLogin(regularMember);
                cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

                // * The owner-only actions toggle must not be rendered for non-admins.
                // The component returns null when isPlaybookAdmin=false so the element
                // should not exist in the DOM at all.
                cy.findByTestId('owner-group-only-actions-toggle').should('not.exist');
            });
        });
    });

    it('toggle is disabled on an archived playbook', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Archived Toggle Playbook ' + getRandomId(),
            memberIDs: [],
            makePublic: true,
        }).then((playbook) => {
            midRunPlaybook = playbook;

            // # Archive the playbook
            cy.apiArchivePlaybook(playbook.id);

            // # Open the outline editor for the archived playbook
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            // * Toggle input is disabled (archived guard in handleOwnerGroupOnlyActionsChange)
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('be.disabled');
        });
    });

    it('toggling the flag mid-run immediately restricts and re-enables finish access — no per-run grandfathering', () => {
        // This test documents the "live-read" behaviour: OwnerGroupOnlyActions is
        // evaluated against the current playbook state on every request, not a
        // snapshot taken at run-creation time. Enabling or disabling the flag
        // takes effect immediately for all in-progress runs.
        let testParticipant;

        cy.apiCreateAndAddUserToTeam(testTeam.id).then((participant) => {
            testParticipant = participant;

            // # Create an unrestricted playbook (owner_group_only_actions = false)
            cy.apiLogin(testAdmin);
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Mid-Run Toggle Playbook ' + getRandomId(),
                memberIDs: [],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                midRunPlaybook = playbook;

                // # Start a run with testAdmin as owner
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'Mid-Run Toggle Run ' + getRandomId(),
                    ownerUserId: testAdmin.id,
                }).then((run) => {
                    midRunRun = run;

                    // # Add participant to the run
                    cy.apiAddUsersToRun(run.id, [testParticipant.id]);

                    // * Phase 1: flag is off — any participant can finish
                    cy.apiLogin(testParticipant);
                    cy.request({
                        headers: {'X-Requested-With': 'XMLHttpRequest'},
                        url: `/plugins/playbooks/api/v0/runs/${run.id}/finish`,
                        method: 'PUT',
                        failOnStatusCode: false,
                    }).then((resp) => {
                        expect(resp.status, 'participant should be able to finish unrestricted run').to.equal(200);
                    });

                    // # Restore the run so we can test the restricted phase
                    cy.apiAdminLogin();
                    cy.apiRestoreRun(run.id);

                    // # Enable the flag on the playbook
                    cy.apiGetPlaybook(playbook.id).then((pb) => {
                        cy.apiUpdatePlaybook({...pb, owner_group_only_actions: true});
                    });

                    // * Phase 2: flag just enabled — same participant is now blocked immediately
                    cy.apiLogin(testParticipant);
                    cy.request({
                        headers: {'X-Requested-With': 'XMLHttpRequest'},
                        url: `/plugins/playbooks/api/v0/runs/${run.id}/finish`,
                        method: 'PUT',
                        failOnStatusCode: false,
                    }).then((resp) => {
                        expect(resp.status, 'participant should be blocked after flag enabled').to.equal(403);
                    });

                    // # Disable the flag again
                    cy.apiAdminLogin();
                    cy.apiGetPlaybook(playbook.id).then((pb) => {
                        cy.apiUpdatePlaybook({...pb, owner_group_only_actions: false});
                    });

                    // * Phase 3: flag disabled — participant regains access immediately
                    cy.apiLogin(testParticipant);
                    cy.request({
                        headers: {'X-Requested-With': 'XMLHttpRequest'},
                        url: `/plugins/playbooks/api/v0/runs/${run.id}/finish`,
                        method: 'PUT',
                        failOnStatusCode: false,
                    }).then((resp) => {
                        expect(resp.status, 'participant should be able to finish after flag disabled').to.equal(200);
                    });
                });
            });
        });
    });
});
