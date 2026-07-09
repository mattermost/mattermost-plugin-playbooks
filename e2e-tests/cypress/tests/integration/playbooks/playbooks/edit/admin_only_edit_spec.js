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
        // Each cy.* call here is enqueued in order so variables are guaranteed
        // to be set before any command that reads them.

        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testAdminUser = user;
        });

        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            testSysadminUser = sysadmin;
        });

        cy.apiCreateUser().then(({user: newUser}) => {
            testMemberUser = newUser;
        });

        // cy.then() defers JS variable reads to execution time, after the
        // commands above have resolved and written to testTeam / testMemberUser.
        cy.then(() => cy.apiAddUserToTeam(testTeam.id, testMemberUser.id));
        cy.then(() => cy.apiLogin(testAdminUser));
        cy.then(() => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Admin Only Edit Playbook ' + getRandomId(),
                memberIDs: [testAdminUser.id],
                makePublic: true,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        // Add testMemberUser as playbook_member after both testPlaybook and
        // testMemberUser are guaranteed to be set.
        cy.then(() => {
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
        cy.playbooksInterceptPlaybookSave();
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // # Click the toggle label to enable
        cy.findByTestId('admin-only-edit-toggle').find('label').click();
        cy.wait('@SavePlaybook');

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
        cy.playbooksInterceptPlaybookSave();

        // # Enable via API as the playbook admin
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Toggle should be checked
        cy.findByTestId('admin-only-edit-toggle').find('input[type="checkbox"]').should('be.checked');

        // # Click to disable
        cy.findByTestId('admin-only-edit-toggle').find('label').click();
        cy.wait('@SavePlaybook');

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
        cy.findByTestId('retrospective-toggle').find('input[type="checkbox"]').should('be.disabled');

        // * "Require new channel for all runs" toggle input is disabled
        cy.findByTestId('new-channel-only-toggle').find('input[type="checkbox"]').should('be.disabled');

        // * "Auto-archive channel" toggle input is disabled
        cy.findByTestId('auto-archive-channel-toggle').find('input[type="checkbox"]').should('be.disabled');

        // * Add-checklist button is not rendered (checklist is read-only)
        cy.get('#checklists').should('be.visible');
        cy.findByTestId('add-a-checklist-button').should('not.exist');

        // * No inline edit pencil anywhere on the page — all MarkdownEdits are disabled (includes #summary)
        cy.get('[data-testid="hover-menu-edit-button"]').should('not.exist');

        // * Title Rename option in the dot-menu is disabled (renders as a non-clickable div, not an <a>)
        // Scope to playbook-editor-header to avoid fragile .first() when other dot-menus are in the DOM
        cy.get('[data-testid="playbook-editor-header"]').findByTestId('menuButton').click();
        cy.get('[data-testid="dropdownmenu"]').should('be.visible');
        cy.get('[data-testid="dropdownmenu"]').within(() => {
            // Disabled DropdownMenuItem renders as styled.div (no href); enabled renders as styled.a href="#"
            cy.contains('Rename').should('not.have.attr', 'href');
        });
        cy.get('body').click(0, 0);
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

        // * "Require new channel for all runs" toggle is not disabled
        cy.findByTestId('new-channel-only-toggle').find('input[type="checkbox"]').should('not.be.disabled');

        // * "Auto-archive channel" toggle is not disabled
        cy.findByTestId('auto-archive-channel-toggle').find('input[type="checkbox"]').should('not.be.disabled');

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

        // # Set up intercept before triggering the action so the request is captured
        cy.intercept('POST', `/plugins/playbooks/api/v0/playbooks/${testPlaybook.id}/duplicate`).as('duplicateAttempt');

        // # Open the dot menu for the locked playbook and click Duplicate
        cy.contains('[data-testid="playbook-item"]', testPlaybook.title).within(() => {
            cy.findByTestId('menuButtonActions').click();
        });
        cy.findByText('Duplicate').click();

        // * Server must reject the request with 403 — wait for it to settle before checking UI
        cy.wait('@duplicateAttempt').its('response.statusCode').should('eq', 403);

        // * No success toast and no copy in the list
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

        // # Intercept before clicking so the request is captured
        cy.intercept('POST', `/plugins/playbooks/api/v0/playbooks/${testPlaybook.id}/duplicate`).as('duplicatePlaybook');

        // # Open the dot menu and click Duplicate
        cy.contains('[data-testid="playbook-item"]', testPlaybook.title).within(() => {
            cy.findByTestId('menuButtonActions').click();
        });
        cy.findByText('Duplicate').click();

        // * Wait for the server to respond before asserting UI state
        cy.wait('@duplicatePlaybook').its('response.statusCode').should('eq', 201);

        // * Verify duplication succeeded
        cy.findByText('Successfully duplicated playbook').should('be.visible');
        cy.contains('Copy of ' + testPlaybook.title).should('be.visible');
    });

    it('non-admin member cannot archive an admin-locked playbook via the dot menu', () => {
        // # Lock the playbook as the playbook admin
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            cy.apiUpdatePlaybook({...pb, admin_only_edit: true});
        });

        // # Login as non-admin member and navigate to the playbooks list
        cy.apiLogin(testMemberUser);
        cy.visit('/playbooks');
        cy.findByTestId('playbooksLHSButton').click();

        // # Open the dot menu for the locked playbook and click the disabled Archive item
        cy.contains('[data-testid="playbook-item"]', testPlaybook.title).within(() => {
            cy.findByTestId('menuButtonActions').click();
        });
        cy.findByText('Archive').click({force: true}); // Archive is disabled for non-admins; force bypasses pointer-events:none to verify no action fires

        // * Give any async click handler a tick to fire before asserting nothing happened
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(300);

        // * Confirm modal must not appear — the Archive item is disabled for non-admin members
        cy.get('#confirmModal').should('not.exist');
    });

    it('any user with create permission can import an admin_only_edit playbook', () => {
        // # Export as admin to get a valid payload, then inject admin_only_edit to simulate
        // # a payload where the flag is set — the import should succeed and strip the flag.
        // importFile is populated in .then() at execution time; all UI commands are top-level
        // so they benefit from full Cypress retry semantics.
        let importFile;
        cy.apiExportPlaybook(testPlaybook.id).then((exportData) => {
            importFile = {
                fileName: 'admin-only-import.json',
                contents: Cypress.Buffer.from(JSON.stringify({...exportData, admin_only_edit: true})),
                mimeType: 'application/json',
            };
        });

        // # Login as member user and open the playbooks list
        cy.apiLogin(testMemberUser);
        cy.visit('/playbooks');
        cy.findByTestId('playbooksLHSButton').click();

        // # Intercept before triggering the file upload so the request is captured
        cy.intercept('POST', '**/api/v0/playbooks/import**').as('importPlaybook');

        // # Upload via the import button — importFile is read at execution time via cy.then()
        cy.findByTestId('titlePlaybook').within(() => {
            cy.then(() => {
                cy.findByTestId('playbook-import-input').selectFile(importFile, {force: true}); // file input is hidden by design
            });
        });

        // # Wait for the import request to settle before asserting the editor opened
        cy.wait('@importPlaybook').its('response.statusCode').should('eq', 201);

        // * Verify the import succeeded — editor opens with the playbook title
        cy.findByTestId('playbook-editor-title').should('contain', testPlaybook.title);
    });
});
