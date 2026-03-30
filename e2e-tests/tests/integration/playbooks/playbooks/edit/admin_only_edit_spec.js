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
    const PLAYBOOK_TITLE = 'Admin Only Edit Playbook ' + getRandomId();

    let testTeam;
    let testAdminUser;
    let testNonMemberUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testAdminUser = user;

            // # Create a team member who is NOT a member of the playbook
            cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUser) => {
                testNonMemberUser = newUser;
            });

            // # Login as admin to create playbook
            cy.apiLogin(testAdminUser);

            // # Create a public playbook (creator becomes admin member)
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: PLAYBOOK_TITLE,
                memberIDs: [testAdminUser.id],
                makePublic: true,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Login as testAdminUser by default
        cy.apiLogin(testAdminUser);

        // # Size the viewport
        cy.viewport('macbook-13');

        // # Reset admin_only_edit to false before each test so tests start from a known state
        cy.apiPatchPlaybook(testPlaybook.id, {admin_only_edit: false});
    });

    afterEach(() => {
        // # Restore the playbook title unconditionally in case a test changed it
        cy.apiLogin(testAdminUser);
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            if (playbook.title !== PLAYBOOK_TITLE) {
                cy.apiUpdatePlaybook({...playbook, title: PLAYBOOK_TITLE}, 200);
            }
        });
    });

    it('shows admin_only_edit toggle in editor and can be toggled by admin', () => {
        // # Visit the playbook outline editor as admin
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Assert admin_only_edit toggle exists
        cy.findByTestId('admin-only-edit-toggle').should('exist');

        // * Assert checkbox is initially unchecked
        cy.findByTestId('admin-only-edit-toggle').find('input').first().should('not.be.checked');

        // # Toggle admin_only_edit on — enabling requires confirmation
        cy.playbooksToggleWithConfirmation('admin-only-edit-toggle');

        // * Assert checkbox is now checked (auto-saved on change)
        cy.findByTestId('admin-only-edit-toggle').find('input').first().should('be.checked');

        // * Assert via API that admin_only_edit was persisted server-side
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            expect(playbook.admin_only_edit, 'admin_only_edit should be true after enabling').to.equal(true);
        });

        // # Toggle it back off (no confirmation needed for disabling)
        cy.findByTestId('admin-only-edit-toggle').find('label').click();

        // * Assert checkbox is unchecked again
        cy.findByTestId('admin-only-edit-toggle').find('input').first().should('not.be.checked');

        // * Assert via API that admin_only_edit was cleared server-side
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            expect(playbook.admin_only_edit, 'admin_only_edit should be false after disabling').to.equal(false);
        });
    });

    it('persists admin_only_edit toggle state after page reload', () => {
        // # Visit the playbook outline editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // # Enable admin_only_edit via the toggle UI
        cy.playbooksToggleWithConfirmation('admin-only-edit-toggle');

        // * Assert checkbox is checked
        cy.findByTestId('admin-only-edit-toggle').find('input').first().should('be.checked');

        // # Reload the page to verify the state persists
        cy.reload();

        // * Assert checkbox is still checked after reload
        cy.findByTestId('admin-only-edit-toggle').find('input').first().should('be.checked');

        // * Assert via API that admin_only_edit is persisted on the server
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            expect(playbook.admin_only_edit, 'admin_only_edit should still be true after reload').to.equal(true);
        });
    });

    // --- Enforcement tests: verify that admin_only_edit actually blocks non-admins ---

    it('non-member cannot see "Add a section" button when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit via the UI toggle (already logged in as admin)
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
        cy.playbooksToggleWithConfirmation('admin-only-edit-toggle');

        // # Login as non-member (team member, not a playbook member)
        cy.apiLogin(testNonMemberUser);

        // # Visit the playbook outline editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * The checklists section is visible but read-only — "Add a section" is absent
        cy.get('[id="checklists"]').should('exist');
        cy.findByTestId('add-a-checklist-button').should('not.exist');
    });

    it('admin can still see "Add a section" button when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit via the UI toggle (already logged in as admin)
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
        cy.playbooksToggleWithConfirmation('admin-only-edit-toggle');

        // * Admin still sees the "Add a section" button (not read-only)
        cy.findByTestId('add-a-checklist-button').should('exist').click();
        cy.findByTestId('checklist-title-input').should('exist');

        // # Cancel by pressing Escape
        cy.get('body').type('{esc}');
    });

    it('REST API rejects playbook update from non-member when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit via API
        cy.apiPatchPlaybook(testPlaybook.id, {admin_only_edit: true}).then(() => {
            // # Login as non-member
            cy.apiLogin(testNonMemberUser);

            // # Non-member fetches the playbook (allowed — it's public) then tries to update it
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                // * The PUT request is rejected with 403 Forbidden
                cy.apiUpdatePlaybook({...playbook, title: 'Unauthorized Update'}, 403);
            });
        });
    });

    // API contract test: verifies the backend still accepts admin PUT requests when
    // admin_only_edit=true. The UI path is tested above via the "Add a section" button.
    it('API contract: admin PUT is accepted when admin_only_edit is enabled', () => {
        // # Enable admin_only_edit via API
        cy.apiPatchPlaybook(testPlaybook.id, {admin_only_edit: true}).then(() => {
            // # Admin updates the title via API
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                cy.apiUpdatePlaybook({...playbook, title: 'Admin Updated Title'}, 200);
            });

            // * Assert the title was updated successfully
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                expect(playbook.title).to.equal('Admin Updated Title');
            });
        });
    });
});
