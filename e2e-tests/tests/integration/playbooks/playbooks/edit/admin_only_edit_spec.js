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
    let testSysadminUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testAdminUser = user;

            cy.apiCreateCustomAdmin().then(({sysadmin}) => {
                testSysadminUser = sysadmin;
            });

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
        cy.intercept('PUT', '/plugins/playbooks/api/v0/playbooks/**').as('savePlaybook');
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // # Click the toggle label to enable
        cy.findByTestId('admin-only-edit-toggle').find('label').click();
        cy.wait('@savePlaybook');

        // * Checkbox should now be checked
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('be.checked');

        // # Fetch playbook via API to confirm the saved value
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            // * admin_only_edit should be persisted as true
            expect(pb.admin_only_edit).to.equal(true);
        });

        // # Reload and verify state persists
        cy.reload();
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('be.checked');
    });

    it('playbook admin disables admin_only_edit via UI toggle', () => {
        cy.intercept('PUT', '/plugins/playbooks/api/v0/playbooks/**').as('savePlaybook');

        // # Enable via API as the playbook admin
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Toggle should be checked
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('be.checked');

        // # Click to disable
        cy.findByTestId('admin-only-edit-toggle').find('label').click();
        cy.wait('@savePlaybook');

        // * Checkbox should now be unchecked
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('not.be.checked');

        // # Fetch playbook via API to confirm the saved value
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            // * admin_only_edit should be persisted as false
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
        cy.findByTestId('preview-content').should('be.visible');

        // * Status update toggle input is disabled
        cy.findByTestId('status-update-toggle').find('input[type="checkbox"]').should('be.disabled');

        // * Retrospective toggle input is disabled
        cy.get('#retrospective').find('input[type="checkbox"]').should('be.disabled');

        // * Add-checklist button is not rendered (checklist is read-only)
        cy.get('#checklists').should('be.visible');
        cy.findByTestId('add-a-checklist-button').should('not.exist');

        // * Summary section has no edit pencil (description is read-only)
        cy.get('#summary').find('[data-testid="hover-menu-edit-button"]').should('not.exist');
    });

    it('UI: playbook admin retains edit access when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit via API
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Visit as playbook admin (testAdminUser is already logged in via beforeEach)
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
        cy.findByTestId('preview-content').should('be.visible');

        // * Status update toggle is not disabled
        cy.findByTestId('status-update-toggle').find('input[type="checkbox"]').should('not.be.disabled');

        // * Add-checklist button is rendered
        cy.findByTestId('add-a-checklist-button').should('exist');

        // * Summary section shows the edit pencil (editable)
        cy.get('#summary').find('[data-testid="hover-menu-edit-button"]').should('exist');
    });

    it('UI: system admin always has edit access and sees the Settings section when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Log in as system admin (not a playbook member) and open the outline
        cy.apiLogin(testSysadminUser);
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
        cy.findByTestId('preview-content').should('be.visible');

        // * Settings section with the toggle is visible to sysadmin
        cy.findByTestId('admin-only-edit-toggle').should('exist');

        // * Status update toggle is not disabled
        cy.findByTestId('status-update-toggle').find('input[type="checkbox"]').should('not.be.disabled');

        // * Add-checklist button is rendered
        cy.findByTestId('add-a-checklist-button').should('exist');

        // * Summary section shows the edit pencil (editable)
        cy.get('#summary').find('[data-testid="hover-menu-edit-button"]').should('exist');
    });

    it('non-admin member cannot duplicate an admin-locked playbook', () => {
        // # Lock the playbook as the playbook admin
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Login as non-admin member and navigate to the playbooks list
        cy.apiLogin(testMemberUser);
        cy.visit('/playbooks');
        cy.findByTestId('playbooksLHSButton').click();

        // # Open the dot menu for the locked playbook and click Duplicate
        cy.contains('[data-testid="playbook-item"]', testPlaybook.title).within(() => {
            cy.findByTestId('menuButtonActions').click();
        });
        cy.findByText('Duplicate').click();

        // * Verify duplication was denied — no success toast and no copy in the list
        cy.findByText('Successfully duplicated playbook').should('not.exist');
        cy.findByText('Copy of ' + testPlaybook.title).should('not.exist');
    });

    it('playbook admin can duplicate an admin-locked playbook', () => {
        // # Lock the playbook
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Navigate to the playbooks list as playbook admin (already logged in via beforeEach)
        cy.visit('/playbooks');
        cy.findByTestId('playbooksLHSButton').click();

        // # Open the dot menu and click Duplicate
        cy.contains('[data-testid="playbook-item"]', testPlaybook.title).within(() => {
            cy.findByTestId('menuButtonActions').click();
        });
        cy.findByText('Duplicate').click();

        // * Verify duplication succeeded
        cy.findByText('Successfully duplicated playbook').should('be.visible');
        cy.contains('Copy of ' + testPlaybook.title).should('be.visible');
    });

    it('any user with create permission can import an admin_only_edit playbook', () => {
        // # Export as admin to get a valid payload, then inject admin_only_edit to simulate
        // # a payload where the flag is set — the import should succeed and strip the flag.
        cy.apiExportPlaybook(testPlaybook.id).then((exportData) => {
            const importFile = {
                fileName: 'admin-only-import.json',
                contents: Cypress.Buffer.from(JSON.stringify({...exportData, admin_only_edit: true})),
                mimeType: 'application/json',
            };

            // # Login as member user and open the playbooks list
            cy.apiLogin(testMemberUser);
            cy.visit('/playbooks');
            cy.findByTestId('playbooksLHSButton').click();

            // # Upload via the import button
            cy.findByTestId('titlePlaybook').within(() => {
                cy.findByTestId('playbook-import-input').selectFile(importFile, {force: true});
            });

            // * Verify the import succeeded — editor opens with the playbook title
            cy.findByTestId('playbook-editor-title').should('contain', testPlaybook.title);
        });
    });
});
