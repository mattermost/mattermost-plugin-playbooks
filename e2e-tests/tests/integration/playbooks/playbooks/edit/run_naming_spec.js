// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../../utils';

describe('playbooks > edit > run naming', {testIsolation: true}, () => {
    const TOKEN_SEQ = '{SEQ}';
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport
        cy.viewport('macbook-13');

        // # Create a fresh playbook for each test
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Run Naming Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
        }).then((playbook) => {
            testPlaybook = playbook;
        });
    });

    afterEach(() => {
        // # Ensure we're logged in as testUser before cleanup — tests may end as a different user
        cy.apiLogin(testUser);

        // # Archive the playbook to free up the run_number_prefix unique constraint
        // # This prevents 409 conflicts when Cypress retries a test with the same prefix
        if (testPlaybook) {
            cy.apiArchivePlaybook(testPlaybook.id);
        }
    });

    it('shows run naming fields inside the Actions section', () => {
        // # Visit the playbook outline editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Assert run number prefix and run name template inputs exist in the Actions section
        cy.findByTestId('channel-access-run-number-prefix').should('exist');
        cy.findByTestId('channel-access-run-name-template-input').should('exist');
    });

    it('saves prefix and template values and shows preview', () => {
        // # Visit the playbook outline editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Wait for the page to load
        cy.findByTestId('channel-access-run-number-prefix').should('exist');

        // # Type 'INC' into prefix input.
        // # Note: the server validates that run_number_prefix must start AND end with an
        // # alphanumeric character (regex: ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$),
        // # so a trailing dash like 'INC-' is invalid. FormatSequentialID appends the
        // # separator dash automatically when building the sequential ID (e.g. 'INC-1').
        cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');
        cy.findByTestId('channel-access-run-number-prefix').clear().type('INC');

        // # Wait for the debounced save to reach the server, then reload so the page
        // # re-initialises with the server-confirmed prefix. This guarantees the
        // # channel_access handleChannelNameTemplateChange closure is fresh and
        // # free of any stale run_number_prefix value before we set the template.
        cy.wait('@UpdatePlaybook');
        cy.reload();

        // * Prefix persists after reload
        cy.findByTestId('channel-access-run-number-prefix').should('have.value', 'INC');

        // # Now set template value on the fresh page — no stale-closure risk
        cy.findByTestId('channel-access-run-name-template-input').then(($el) => {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call($el[0], `${TOKEN_SEQ} - Incident-Report`);
            $el[0].dispatchEvent(new Event('input', {bubbles: true}));
        });

        // * Assert preview section is shown with resolved prefix and template.
        // # The preview renders the sequential ID as 'INC-N' (FormatSequentialID adds the
        // # separator dash), so the preview contains 'INC-' even though prefix is 'INC'.
        cy.findByTestId('channel-access-run-name-template-preview').should('exist');
        cy.findByTestId('channel-access-run-name-template-preview').should('contain', 'INC-');
        cy.findByTestId('channel-access-run-name-template-preview').should('contain', 'Incident-Report');

        // # Wait for the debounced template save to reach the server before reloading
        cy.wait('@UpdatePlaybook');
        cy.reload();

        // * Both values survive the second reload — confirms both were persisted server-side
        cy.findByTestId('channel-access-run-number-prefix').should('have.value', 'INC');
        cy.findByTestId('channel-access-run-name-template-input').should('have.value', `${TOKEN_SEQ} - Incident-Report`);
    });

    it('shows a warning when template references an unknown field', () => {
        // # Visit the playbook outline editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Wait for the page to load
        cy.findByTestId('channel-access-run-name-template-input').should('exist');

        // # Set template value with unknown field using native value setter to avoid opening
        // # the token dropdown (typing '{' would open it and steal focus)
        cy.findByTestId('channel-access-run-name-template-input').then(($el) => {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call($el[0], '{UnknownField}');
            $el[0].dispatchEvent(new Event('input', {bubbles: true}));
        });

        // * Assert warning is shown for unknown field reference
        cy.findByTestId('channel-access-run-name-template-warning').should('exist');
        cy.findByTestId('channel-access-run-name-template-warning').should('contain', 'UnknownField');
    });

    it('persists prefix and template values set via API and shows them in editor', () => {
        // # Set prefix and template values via API to avoid blur timing issues
        // Note: prefix must be alphanumeric (no trailing dash) — FormatSequentialID adds the dash
        cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: 'INC', channel_name_template: `${TOKEN_SEQ} - Incident`}).then(() => {
            // # Visit the playbook outline editor
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // * Assert prefix value is loaded from API
            cy.findByTestId('channel-access-run-number-prefix').should('have.value', 'INC');

            // * Assert template value is loaded from API
            cy.findByTestId('channel-access-run-name-template-input').should('have.value', `${TOKEN_SEQ} - Incident`);
        });
    });

    it('run started from a playbook with SEQ template gets the resolved sequential ID in its name', () => {
        // # Set prefix and template via API
        cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: 'SEQ', channel_name_template: `${TOKEN_SEQ} - Convention`}).then(() => {
            // # Open the Run playbook modal from the outline editor
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            cy.findByTestId('channel-access-run-name-template-input').should('exist');
            cy.findByTestId('run-playbook').click();

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert the run name input is pre-filled with the template (modal initializes
                // # it to the channel_name_template so the user can see and edit it)
                cy.findByTestId('run-name-input').should('have.value', `${TOKEN_SEQ} - Convention`);

                // * Assert the name preview shows the resolved value (SEQ-N - Convention)
                cy.findByTestId('run-name-preview').should('exist');
                cy.findByTestId('run-name-preview').should('contain', 'SEQ-');
                cy.findByTestId('run-name-preview').should('contain', 'Convention');

                // # Submit the modal to start the run (no required fields to fill)
                cy.findByTestId('modal-confirm-button').should('not.be.disabled').click();
            });

            // * Verify we are on the run details page
            cy.url().should('include', '/playbooks/runs/');

            // * Verify run name contains the sequential ID prefix and template suffix
            cy.get('h1').should('contain', 'SEQ-');
            cy.get('h1').should('contain', 'Convention');

            // * Verify backend state: run.name is fully resolved and sequential_id is set
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.assertRunNameResolved(runId, 'SEQ-');
                cy.assertRunNameResolved(runId, 'Convention');

                // Verify sequential_id is stored in backend (not just rendered in UI)
                cy.apiGetPlaybookRun(runId).then(({body: runData}) => {
                    expect(runData.sequential_id).to.not.be.empty;
                    expect(runData.sequential_id).to.include('SEQ-');
                });
            });
        });
    });

    it('shows an insert variable button next to the template input', () => {
        // # Visit the playbook outline editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Wait for the page to load
        cy.findByTestId('channel-access-run-name-template-input').should('be.visible');

        // * The insert variable button exists with a tooltip
        cy.findByTestId('channel-access-run-name-template-insert-variable').should('exist');
        cy.findByTestId('channel-access-run-name-template-insert-variable').should('have.attr', 'title', 'Insert variable');
    });

    it('clicking insert variable button and selecting a token inserts it into the template', () => {
        // # Visit the playbook outline editor
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

        // * Wait for the page to load
        cy.findByTestId('channel-access-run-name-template-input').should('be.visible');

        // # Clear template first
        cy.findByTestId('channel-access-run-name-template-input').clear();

        // # Click the insert variable button
        cy.findByTestId('channel-access-run-name-template-insert-variable').click();

        // * The suggestion list should appear
        cy.findByTestId('channel-access-run-name-template-suggestions').should('be.visible');

        // # Click the {SEQ} suggestion (mousedown — the handler uses onMouseDown)
        cy.findByTestId('channel-access-run-name-template-suggestion-SEQ').trigger('mousedown');

        // * The template input should now contain {SEQ}
        cy.findByTestId('channel-access-run-name-template-input').should('have.value', '{SEQ}');
    });

    it('insert variable appends token at end when template already has content', () => {
        // # Set an initial template via API
        cy.apiPatchPlaybook(testPlaybook.id, {channel_name_template: 'Incident - '}).then(() => {
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            cy.findByTestId('channel-access-run-name-template-input').should('have.value', 'Incident - ');

            // # Click the insert variable button
            cy.findByTestId('channel-access-run-name-template-insert-variable').click();

            // * The suggestion list should appear
            cy.findByTestId('channel-access-run-name-template-suggestions').should('be.visible');

            // # Click the {OWNER} suggestion (mousedown — the handler uses onMouseDown)
            cy.findByTestId('channel-access-run-name-template-suggestion-OWNER').trigger('mousedown');

            // * The template should have the token appended
            cy.findByTestId('channel-access-run-name-template-input').should('have.value', 'Incident - {OWNER}');
        });
    });

    it('handles prefix with special characters gracefully', () => {
        // # 'ABC-' has a trailing dash — FormatSequentialID appends another dash,
        // # so the sequential_id should be 'ABC--N'. The key assertion is that the
        // # run was created successfully and sequential_id is non-empty (no crash).
        cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: 'ABC-'}).then(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'Special Prefix Run',
                ownerUserId: testUser.id,
            }).then(({id: runId}) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    // * Run was created successfully
                    expect(run.id).to.be.a('string').and.not.be.empty;

                    // * Name matches the provided run name (no template set)
                    expect(run.name).to.equal('Special Prefix Run');

                    // * sequential_id was generated and contains the prefix
                    expect(run.sequential_id).to.be.a('string').and.include('ABC-');
                });
            });
        });
    });

    it('uses prefix-only template when no run name template is set', () => {
        cy.apiPatchPlaybook(testPlaybook.id, {
            run_number_prefix: 'PFX',
            channel_name_template: '',
        }).then(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'Default Name Run',
                ownerUserId: testUser.id,
            }).then(({id: runId}) => {
                cy.assertRunNameResolved(runId, 'Default Name Run');
            });
        });
    });
});
