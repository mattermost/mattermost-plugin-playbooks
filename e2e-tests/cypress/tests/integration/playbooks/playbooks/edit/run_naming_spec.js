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

            cy.apiLogin(user);

            // # Create a single shared playbook; state is reset per test via apiPatchPlaybook.
            cy.apiCreatePlaybook({
                teamId: team.id,
                title: 'Run Naming Playbook ' + getRandomId(),
                memberIDs: [user.id],
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    after(() => {
        cy.apiLogin(testUser);
        if (testPlaybook) {
            cy.apiArchivePlaybook(testPlaybook.id);
        }
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');

        // # Reset mutable fields so each test starts from a clean state
        cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: '', channel_name_template: ''});
    });

    it('shows run naming fields inside the Actions section', () => {
        // # Visit the playbook outline editor
        cy.playbooksVisitEditor(testPlaybook.id, 'outline');

        // * Assert run number prefix and run name template inputs exist in the Actions section
        cy.findByTestId('channel-access-run-number-prefix').should('exist');
        cy.findByTestId('channel-access-run-name-template-input').should('exist');
    });

    it('saves prefix and template values and shows preview', () => {
        // # Set prefix via API — avoids coupling the test to how many REST PUTs fire
        // # while typing (with or without debounce the server always ends up with the
        // # right value, but cy.wait catches only the first request).
        cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: 'INC'}).then(() => {
            cy.playbooksVisitEditor(testPlaybook.id, 'outline');

            // * Prefix is loaded from server
            cy.findByTestId('channel-access-run-number-prefix').should('have.value', 'INC');

            // # Intercept the REST PATCH for the template save
            cy.playbooksInterceptPatchPlaybook();

            // # Type the template and dismiss the autocomplete dropdown
            cy.findByTestId('channel-access-run-name-template-input').type(`${TOKEN_SEQ} - Incident-Report`, {parseSpecialCharSequences: false});
            cy.findByTestId('channel-access-run-name-template-input').type('{esc}');

            // * Preview shows the resolved sequential ID ('INC-N') and the template suffix
            cy.findByTestId('channel-access-run-name-template-preview').should('exist');
            cy.findByTestId('channel-access-run-name-template-preview').should('contain', 'INC-');
            cy.findByTestId('channel-access-run-name-template-preview').should('contain', 'Incident-Report');

            // # Wait for the debounced template save before reloading
            cy.wait('@PatchPlaybook');
            cy.reload();

            // * Both values survive reload — confirms both were persisted server-side
            cy.findByTestId('channel-access-run-number-prefix').should('have.value', 'INC');
            cy.findByTestId('channel-access-run-name-template-input').should('have.value', `${TOKEN_SEQ} - Incident-Report`);
        });
    });

    it('preserves UI-typed prefix after a later template edit triggers a GraphQL refetch', () => {
        // Regression: run_number_prefix is REST-only (not in the GraphQL Playbook schema),
        // and the REST playbook hook does not refetch after a successful PATCH. A later edit
        // that triggers updatePlaybook (e.g. typing in the channel name template) refetches
        // PlaybookDocument and recomputes the merged playbook source; if the stale
        // REST-fetched prefix were used, useProxyState would sync the prefix field back to
        // the old value and silently wipe what the user typed.

        // # Visit the editor with a playbook that has no saved prefix yet
        cy.playbooksVisitEditor(testPlaybook.id, 'outline');

        // * Prefix field is empty initially
        cy.findByTestId('channel-access-run-number-prefix').should('have.value', '');

        // # Intercept REST PATCH so we can wait for the debounced prefix save
        cy.playbooksInterceptPatchPlaybook();

        // # Type the prefix in the UI (not via API — the bug requires UI-initiated save
        // # so that restPlaybook becomes stale relative to the just-saved value)
        cy.findByTestId('channel-access-run-number-prefix').type('INC');

        // # Wait for the debounced PATCH to land server-side
        cy.wait('@PatchPlaybook').its('response.statusCode').should('be.oneOf', [200, 204]);

        // * Prefix is still visible after save
        cy.findByTestId('channel-access-run-number-prefix').should('have.value', 'INC');

        // # Now type in the template field. This triggers updatePlaybook (GraphQL) which
        // # refetches PlaybookDocument and recomputes the merged playbook source.
        cy.findByTestId('channel-access-run-name-template-input').type(`${TOKEN_SEQ} - Incident`, {parseSpecialCharSequences: false});
        cy.findByTestId('channel-access-run-name-template-input').type('{esc}');

        // # Wait for the REST template save. The proxy state's GraphQL updatePlaybook fires
        // # from the same 500ms debounce, so by the time PATCH responds the mutation has
        // # been sent. We then wait for the Apollo refetch + re-render cycle to complete —
        // # the bug (if present) wipes the prefix during this window, so the assertion
        // # below would catch it on retry.
        cy.wait('@PatchPlaybook').its('response.statusCode').should('be.oneOf', [200, 204]);

        // * The prefix MUST NOT disappear from the input after the GraphQL refetch
        cy.findByTestId('channel-access-run-number-prefix').should('have.value', 'INC');

        // * Preview reflects the still-present prefix (would show bare '00001' style if prefix were wiped)
        cy.findByTestId('channel-access-run-name-template-preview').should('contain', 'INC-');
    });

    it('shows a warning when template references an unknown field', () => {
        // # Visit the playbook outline editor
        cy.playbooksVisitEditor(testPlaybook.id, 'outline');

        // * Wait for the page to load
        cy.findByTestId('channel-access-run-name-template-input').should('exist');

        // # Type a valid prefix first to prime the input
        cy.findByTestId('channel-access-run-name-template-input').type('Test - ', {parseSpecialCharSequences: false});

        // # Now type an unknown field reference
        cy.findByTestId('channel-access-run-name-template-input').type('{UnknownField}', {parseSpecialCharSequences: false});

        // # Dismiss any dropdown that opened when typing '{'
        cy.findByTestId('channel-access-run-name-template-input').type('{esc}');

        // * Assert the input contains the unknown field reference
        cy.findByTestId('channel-access-run-name-template-input').should('have.value', 'Test - {UnknownField}');

        // * Assert warning is shown for unknown field reference
        cy.findByTestId('channel-access-run-name-template-warning').should('exist');
        cy.findByTestId('channel-access-run-name-template-warning').should('contain', 'UnknownField');

        // * Note: The server rejects unknown fields on save, so this invalid template
        // * will not persist, but the UI warning correctly identifies the invalid field.
    });

    it('persists prefix and template values set via API and shows them in editor', () => {
        // # Set prefix and template values via API to avoid blur timing issues
        // # Note: prefix must be alphanumeric (no trailing dash) — FormatSequentialID adds the dash
        cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: 'INC', channel_name_template: `${TOKEN_SEQ} - Incident`}).then(() => {
            // # Visit the playbook outline editor
            cy.playbooksVisitEditor(testPlaybook.id, 'outline');

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
            cy.playbooksVisitEditor(testPlaybook.id, 'outline');
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

                // * Verify sequential_id is stored in backend (not just rendered in UI)
                cy.apiGetPlaybookRun(runId).then(({body: runData}) => {
                    expect(runData.sequential_id).to.not.be.empty;
                    expect(runData.sequential_id).to.include('SEQ-');
                });
            });
        });
    });

    it('typing { in the template input opens autocomplete with SEQ, OWNER, and CREATOR tokens', () => {
        // # Visit the playbook outline editor
        cy.playbooksVisitEditor(testPlaybook.id, 'outline');

        // * Wait for the template input to be visible
        cy.findByTestId('channel-access-run-name-template-input').scrollIntoView().should('be.visible');

        // # Type an opening brace — this triggers the autocomplete dropdown
        cy.findByTestId('channel-access-run-name-template-input').type('{', {parseSpecialCharSequences: false});

        // * The suggestion list should be visible
        cy.findByTestId('channel-access-run-name-template-suggestions').should('be.visible');

        // * The three built-in tokens are always present in the suggestions
        cy.findByTestId('channel-access-run-name-template-suggestions').within(() => {
            cy.findByText('{SEQ}').should('exist');
            cy.findByText('{OWNER}').should('exist');
            cy.findByText('{CREATOR}').should('exist');
        });
    });

    it('shows an insert variable button next to the template input', () => {
        // # Visit the playbook outline editor
        cy.playbooksVisitEditor(testPlaybook.id, 'outline');

        // * Wait for the page to load — scroll into view first because the
        // Actions section may be below the fold in the scrollable container
        cy.findByTestId('channel-access-run-name-template-input').scrollIntoView().should('be.visible');

        // * The insert variable button exists with a tooltip
        cy.findByTestId('channel-access-run-name-template-insert-variable').should('exist');
        cy.findByTestId('channel-access-run-name-template-insert-variable').should('have.attr', 'title', 'Insert variable');
    });

    it('clicking insert variable button and selecting a token inserts it into the template', () => {
        // # Set up playbook with existing template via API
        cy.apiPatchPlaybook(testPlaybook.id, {channel_name_template: 'Incident - '}).then(() => {
            // # Visit the playbook outline editor
            cy.playbooksVisitEditor(testPlaybook.id, 'outline');

            // * Wait for the page to load — scroll into view first because the
            // Actions section may be below the fold in the scrollable container
            cy.findByTestId('channel-access-run-name-template-input').scrollIntoView().should('be.visible');

            // * Verify initial content is loaded from API
            cy.findByTestId('channel-access-run-name-template-input').should('have.value', 'Incident - ');

            // # Intercept the REST PATCH so we can wait for the debounced template save
            cy.playbooksInterceptPatchPlaybook();

            // # Click the insert variable button
            cy.findByTestId('channel-access-run-name-template-insert-variable').click();

            // * The suggestion list should appear
            cy.findByTestId('channel-access-run-name-template-suggestions').should('be.visible');

            // # Select the {OWNER} suggestion by clicking it directly (avoids index-order fragility)
            cy.findByTestId('channel-access-run-name-template-suggestions').within(() => {
                cy.findByText('{OWNER}').scrollIntoView().click();
            });

            // * The template input should now have the second suggestion appended (OWNER)
            cy.findByTestId('channel-access-run-name-template-input').should('have.value', 'Incident - {OWNER}');

            // # Wait for the debounced save to reach the server
            cy.wait('@PatchPlaybook');

            // * Assert via API that the {OWNER} token was persisted
            cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
                expect(pb.channel_name_template).to.include('{OWNER}');
            });
        });
    });

    it('insert variable appends token at end when template already has content', () => {
        // # Set an initial template via API
        cy.apiPatchPlaybook(testPlaybook.id, {channel_name_template: 'Incident - '}).then(() => {
            cy.playbooksVisitEditor(testPlaybook.id, 'outline');

            cy.findByTestId('channel-access-run-name-template-input').should('have.value', 'Incident - ');

            // # Intercept the REST PATCH so we can wait for the debounced template save
            cy.playbooksInterceptPatchPlaybook();

            // # Click the insert variable button
            cy.findByTestId('channel-access-run-name-template-insert-variable').click();

            // * The suggestion list should appear
            cy.findByTestId('channel-access-run-name-template-suggestions').should('be.visible');

            // # Select the {OWNER} suggestion by clicking it directly (avoids index-order fragility)
            cy.findByTestId('channel-access-run-name-template-suggestions').within(() => {
                cy.findByText('{OWNER}').scrollIntoView().click();
            });

            // * The template should have the token appended
            cy.findByTestId('channel-access-run-name-template-input').should('have.value', 'Incident - {OWNER}');

            // * Assert via API that the {OWNER} token was persisted
            cy.wait('@PatchPlaybook');
            cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
                expect(pb.channel_name_template).to.include('{OWNER}');
            });
        });
    });

    it('handles prefix with special characters gracefully', () => {
        // # 'ABC-' has a trailing dash — NormalizeRunNumberPrefix trims it to 'ABC'
        // # before storing. So FormatSequentialID('ABC', 1) produces 'ABC-00001'.
        // # The key assertion is that normalization occurs and the run is created successfully.
        cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: 'ABC-'}).then(() => {
            // * Assert via API that the prefix was normalized (trailing dash trimmed to 'ABC')
            cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
                expect(pb.run_number_prefix).to.equal('ABC');
            });

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

    it('template using {SEQ} shows a warning when no run number prefix is set', () => {
        // # Visit the playbook outline editor
        cy.playbooksVisitEditor(testPlaybook.id, 'outline');

        // * Prefix input is empty (default for fresh playbook)
        cy.findByTestId('channel-access-run-number-prefix').should('have.value', '');

        // # Type {SEQ} into the template input. The closing } causes the autocomplete
        // # dropdown to close immediately (findTrigger returns null on }), so no ESC is
        // # needed. Pressing ESC would trigger browser-native input reset, clearing the
        // # value and hiding the warning before the assertion runs.
        cy.findByTestId('channel-access-run-name-template-input').type(TOKEN_SEQ, {parseSpecialCharSequences: false});

        // * Warning is shown when {SEQ} is used with no prefix
        cy.findByTestId('channel-access-run-name-template-warning').should('exist');
    });

    it('template editor shows property field names as valid (no unknown-field warning)', () => {
        // This test guards against a regression where the editor fetched property fields
        // from a separate endpoint but the code was reading restPlaybook?.propertyFields
        // (always undefined) instead, causing every field reference to show as "unknown".

        // # Create a property field on the playbook
        cy.apiAddPropertyField(testPlaybook.id, {name: 'Zone', type: 'select', attrs: {options: [{name: 'Alpha'}, {name: 'Bravo'}]}});

        // # Set a template that references the property field
        cy.apiPatchPlaybook(testPlaybook.id, {channel_name_template: '{Zone} - Incident'});

        // # Visit the playbook editor Actions section
        cy.playbooksVisitEditor(testPlaybook.id, 'outline');

        // * Template input is loaded with the template value
        cy.findByTestId('channel-access-run-name-template-input').should('have.value', '{Zone} - Incident');

        // * No "Unknown field references" warning — Zone is a known property field
        cy.findByTestId('channel-access-run-name-template-warning').should('not.exist');
    });

    it('clearing both channel_name_template and run_number_prefix in a single update succeeds', () => {
        // # Create a playbook with both fields set
        cy.apiPatchPlaybook(testPlaybook.id, {
            run_number_prefix: 'INC',
            channel_name_template: TOKEN_SEQ,
        }).then(() => {
            // * Verify both fields are set before clearing
            cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
                expect(pb.run_number_prefix).to.equal('INC');
                expect(pb.channel_name_template).to.equal(TOKEN_SEQ);
            });

            // # Clear both fields in a single PATCH call
            cy.apiPatchPlaybook(testPlaybook.id, {
                run_number_prefix: '',
                channel_name_template: '',
            });

            // * Verify the cleared values are persisted server-side
            cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
                expect(pb.run_number_prefix).to.equal('');
                expect(pb.channel_name_template).to.equal('');
            });
        });
    });
});
