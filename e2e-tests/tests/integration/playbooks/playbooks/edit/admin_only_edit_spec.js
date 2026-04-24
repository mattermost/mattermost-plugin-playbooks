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

    it('REST API: playbook admin (non-sysadmin) cannot enable admin_only_edit (403)', () => {
        // # admin_only_edit is false (reset by beforeEach); testAdminUser is playbook admin but not sysadmin
        cy.apiLogin(testAdminUser);
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true}, 403);
        });

        // * Confirm admin_only_edit is still false
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            expect(pb.admin_only_edit).to.equal(false);
        });
    });

    it('UI: toggle reverts when playbook admin tries to enable admin_only_edit', () => {
        // # testAdminUser is playbook admin but not sysadmin — the server will reject enabling
        cy.apiLogin(testAdminUser);
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Toggle starts unchecked
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('not.be.checked');

        // # Click to attempt enabling
        cy.findByTestId('admin-only-edit-toggle').find('label').click();

        // * Toggle should revert to unchecked after the server rejects the change
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('not.be.checked');

        // * API confirms admin_only_edit is still false
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            expect(pb.admin_only_edit).to.equal(false);
        });
    });

    it('UI: editor fields are disabled for non-admin member when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit as sysadmin
        cy.apiAdminLogin();
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Login as non-admin member and open the outline
        cy.apiLogin(testMemberUser);
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Status update toggle input is disabled
        cy.findByTestId('status-update-toggle').find('input[type="checkbox"]').should('be.disabled');

        // * Retrospective toggle input is disabled
        cy.get('#retrospective').find('input[type="checkbox"]').should('be.disabled');

        // * Add-checklist button is not rendered (checklist is read-only)
        cy.get('#checklists').should('be.visible');
        cy.findByTestId('add-a-checklist-button').should('not.exist');
    });

    it('REST API: non-sysadmin cannot create a playbook with admin_only_edit enabled (403)', () => {
        // # testAdminUser is a playbook admin but not a sysadmin
        cy.apiLogin(testAdminUser);

        cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: '/plugins/playbooks/api/v0/playbooks',
            method: 'POST',
            body: {
                title: 'New Playbook With Admin Only Edit',
                team_id: testTeam.id,
                public: true,
                admin_only_edit: true,
                members: [{user_id: testAdminUser.id, roles: ['playbook_member', 'playbook_admin']}],
                checklists: [],
                reminder_timer_default_seconds: 86400,
                status_update_enabled: true,
                retrospective_enabled: true,
                create_channel_member_on_new_participant: true,
            },
            failOnStatusCode: false,
        }).then((response) => {
            expect(response.status).to.equal(403);
        });
    });

    it('REST API: non-sysadmin cannot duplicate a playbook with admin_only_edit enabled (403)', () => {
        // # Enable admin_only_edit on the source playbook as sysadmin
        cy.apiAdminLogin();
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # testAdminUser is playbook admin but not sysadmin — duplicate should be blocked
        cy.apiLogin(testAdminUser);
        cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: `/plugins/playbooks/api/v0/playbooks/${testPlaybook.id}/duplicate`,
            method: 'POST',
            failOnStatusCode: false,
        }).then((response) => {
            expect(response.status).to.equal(403);
        });
    });

    it('REST API: non-sysadmin cannot import a playbook with admin_only_edit enabled (403)', () => {
        // # Export the playbook as sysadmin, then set admin_only_edit in the export data
        cy.apiAdminLogin();
        cy.apiExportPlaybook(testPlaybook.id).then((exportData) => {
            const importBody = {...exportData, id: undefined, admin_only_edit: true};

            // # Login as non-sysadmin and attempt import
            cy.apiLogin(testAdminUser);
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: `/plugins/playbooks/api/v0/playbooks/import?team_id=${testTeam.id}`,
                method: 'POST',
                body: importBody,
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(403);
            });
        });
    });
});
