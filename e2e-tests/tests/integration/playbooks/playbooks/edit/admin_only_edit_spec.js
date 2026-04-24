// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../../utils';

describe('playbooks > edit > admin only edit', {testIsolation: true}, () => {
    let testTeam;
    let testAdminUser;
    let testMemberUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testAdminUser = user;

            // # Create a regular (non-admin) playbook member
            cy.apiCreateUser().then(({user: newUser}) => {
                testMemberUser = newUser;
                cy.apiAddUserToTeam(testTeam.id, testMemberUser.id);
            });

            cy.apiLogin(testAdminUser);

            // # Create a public playbook — creator becomes playbook_admin
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Admin Only Edit Playbook ' + getRandomId(),
                memberIDs: [testAdminUser.id],
                makePublic: true,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Add testMemberUser as playbook_member (non-admin)
                cy.apiGetPlaybook(testPlaybook.id).then((fetched) => {
                    cy.apiUpdatePlaybook({
                        ...fetched,
                        members: [
                            ...fetched.members,
                            {user_id: testMemberUser.id, roles: ['playbook_member']},
                        ],
                    });
                });
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(testAdminUser);
        cy.viewport('macbook-13');

        // # Reset admin_only_edit to false before each test
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: false});
        });
    });

    it('shows the admin-only-edit toggle in the Settings section for playbook admins', () => {
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Settings section with the toggle should be visible
        cy.findByTestId('admin-only-edit-toggle').should('exist');

        // * Toggle checkbox should be unchecked initially
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('not.be.checked');
    });

    it('does not show the admin-only-edit toggle for non-admin playbook members', () => {
        cy.apiLogin(testMemberUser);
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Toggle should not be visible for non-admin member
        cy.findByTestId('preview-content').should('be.visible');
        cy.findByTestId('admin-only-edit-toggle').should('not.exist');
    });

    it('enables admin_only_edit via UI toggle and persists after reload', () => {
        // # Only system admins can enable admin_only_edit — visit as sysadmin
        cy.apiAdminLogin();
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // # Click the toggle label to enable
        cy.findByTestId('admin-only-edit-toggle').find('label').click();

        // * Checkbox should now be checked
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('be.checked');

        // * API confirms the value was saved
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            expect(pb.admin_only_edit).to.equal(true);
        });

        // # Reload and verify state persists
        cy.reload();
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('be.checked');
    });

    it('disables admin_only_edit via UI toggle', () => {
        // # Enable via API as sysadmin (only sysadmins can enable admin_only_edit)
        cy.apiAdminLogin();
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Visit as playbook admin who can disable it
        cy.apiLogin(testAdminUser);
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Toggle should be checked
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('be.checked');

        // # Click to disable
        cy.findByTestId('admin-only-edit-toggle').find('label').click();

        // * Checkbox should now be unchecked
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('not.be.checked');

        // * API confirms the value was saved
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            expect(pb.admin_only_edit).to.equal(false);
        });
    });

    it('REST API: non-admin playbook member is blocked (403) when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit via API as sysadmin (only sysadmins can enable it)
        cy.apiAdminLogin();
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Login as non-admin member and attempt update
        cy.apiLogin(testMemberUser);
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, title: 'Member Unauthorized Update'}, 403);
        });
    });

    it('REST API: non-admin playbook member can update when admin_only_edit is disabled', () => {
        // # admin_only_edit is false (reset by beforeEach)
        cy.apiLogin(testMemberUser);
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, title: 'Member Allowed Update'}, 200);
        });
    });

    it('REST API: playbook admin can update when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit via API as sysadmin (only sysadmins can enable it)
        cy.apiAdminLogin();
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Playbook admin updates title — should succeed
        cy.apiLogin(testAdminUser);
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, title: 'Admin Allowed Update'}, 200);
        });

        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            expect(pb.title).to.equal('Admin Allowed Update');
        });
    });

    it('REST API: system admin can update when admin_only_edit is enabled', () => {
        // # Enable and update as sysadmin
        cy.apiAdminLogin();
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, title: 'Sysadmin Allowed Update'}, 200);
        });

        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            expect(pb.title).to.equal('Sysadmin Allowed Update');
        });
    });
});
