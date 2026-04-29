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

    it('playbook admin enables admin_only_edit via UI toggle and persists after reload', () => {
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

    it('playbook admin disables admin_only_edit via UI toggle', () => {
        // # Enable via API as the playbook admin
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

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

    it('UI: editor fields are disabled for non-admin member when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit as playbook admin
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

    it('non-admin member cannot duplicate an admin-locked playbook', () => {
        // # Lock the playbook as the playbook admin
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Attempt duplication as a plain member — must be denied
        cy.apiLogin(testMemberUser);
        cy.request({
            url: `/plugins/playbooks/api/v0/playbooks/${testPlaybook.id}/duplicate`,
            method: 'POST',
            failOnStatusCode: false,
        }).its('status').should('eq', 403);
    });

    it('playbook admin can duplicate an admin-locked playbook', () => {
        // # Lock the playbook
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Playbook admin duplicates — succeeds, new copy is editable by the duplicator
        cy.request({
            url: `/plugins/playbooks/api/v0/playbooks/${testPlaybook.id}/duplicate`,
            method: 'POST',
        }).then((resp) => {
            expect(resp.status).to.equal(201);
            expect(resp.body.id).to.be.a('string');
            expect(resp.body.id).to.not.equal(testPlaybook.id);
        });
    });

    it('any user with create permission can import an admin_only_edit playbook', () => {
        // # Importer becomes admin of the new playbook, so no special gate is needed.
        // Version must match app.CurrentPlaybookExportVersion.
        const payload = {
            title: 'Imported Locked Playbook',
            admin_only_edit: true,
            version: 1,
        };

        cy.apiLogin(testMemberUser);
        cy.request({
            url: `/plugins/playbooks/api/v0/playbooks/import?team_id=${testTeam.id}`,
            method: 'POST',
            body: payload,
        }).then((resp) => {
            expect(resp.status).to.equal(201);
            expect(resp.body.id).to.be.a('string');
        });
    });
});
