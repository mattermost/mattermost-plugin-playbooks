// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Playwright port of:
//   e2e-tests/cypress/tests/integration/playbooks/channels/run_spec.js (all tests)
//   e2e-tests/cypress/tests/integration/playbooks/channels/run_dialog_spec.js (all tests)
//   e2e-tests/cypress/tests/integration/playbooks/playbooks/overview_spec.js
//     ("should switch to channels and prompt to run" ×5, "start a run",
//      "start a run > create a new channel / in existing channel")
//   e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_spec.js
//     ("from playbook list > defaults")
//   e2e-tests/cypress/tests/integration/playbooks/channels/general_actions_spec.js
//     (only "keyword trigger > prompt to run playbook" where "Yes, run playbook" opens the dialog)
//
// Consolidation notes (P3):
//   • overview_spec.js > start a run > create a new channel: covered by this spec (see
//     "Run Playbook button opens modal from own team and cross-team contexts" which creates a run
//     from the editor and verifies LHS appearance).
//   • overview_spec.js > start a run > in existing channel: the "link-existing-channel"
//     Outline-action UI path and the run-modal channel-selector behaviors are substantially
//     covered in start_run_modal.spec.ts (ported from start_run_spec.js). The overview_spec
//     test overlaps with those cases; attribution to that spec is noted here.
//
// NOTE on dialogs:
//   • Slash command (/playbook run) and post-actions menu "Run playbook" open the
//     Mattermost Interactive Dialog (apps modal) → use mm.interactiveRunDialog (MattermostCore).
//   • Playbook list "Run" button and playbook editor "Run Playbook" open the custom
//     React RunModal component → use RunModal page object.
// See also: e2e-tests/playwright/tests/pages/mattermost/interactive_run_dialog.ts

import {test, expect} from '@playwright/test';

import {loginAs, loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {createChannel, createKeywordRunPlaybookAction, type Channel} from '../helpers/channel';
import {createPlaybook, type Playbook} from '../helpers/playbook';
import {getRunByName} from '../helpers/run';
import {addUserToTeam, createTeam, type Team} from '../helpers/team';
import {createUser, getCurrentUser, type SeededUser} from '../helpers/user';
import {ChannelRhs} from '../pages/channel_rhs';
import {MattermostCore} from '../pages/mattermost';
import {PlaybookEditorPage} from '../pages/playbook_editor_page';
import {PlaybooksPage} from '../pages/playbooks_page';
import {RunDetailsPage} from '../pages/run_details_page';
import {RunModal} from '../pages/run_modal';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

// ─────────────────────────────────────────────────────────────────────────────
// Entry points: slash command + post menu (public / private channel)
// Both use the Mattermost Interactive Dialog (apps modal), not the RunModal.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('run start entry points: slash command and post menu', () => {
    let teamName: string;
    let teamId: string;
    let user: SeededUser;
    let privateChannelName: string;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);
        const team = await createTeam(page, 'run-entry');
        const u = await createUser(page, 'run-entry-user');
        await addUserToTeam(page, team.id, u.id);

        // Log in as the user to create the playbook (user becomes owner/member automatically)
        await loginAs(page, u.username, u.password);

        const pb = await createPlaybook(page, team.id, `Entry PB ${uniqueSuffix()}`);
        const privateChannel = await createChannel(page, team.id, {type: 'P', displayName: 'Private Entry'});

        teamName = team.name;
        teamId = team.id;
        user = u;
        void pb; // playbook auto-selected in the interactive dialog (single playbook)
        privateChannelName = privateChannel.name;

        await context.close();
    });

    // Table of {label, channelName, useSlashCommand} cases covering all four combinations.
    // Each row opens the Interactive Run Dialog, fills a unique run name,
    // confirms, and verifies the run is active via the REST API.
    type ChannelCase = {label: string; channelName: string; useSlashCommand: boolean};

    const cases: ChannelCase[] = [
        {label: 'slash command in public channel', channelName: 'off-topic', useSlashCommand: true},
        {label: 'slash command in private channel', channelName: '', useSlashCommand: true},
        {label: 'post menu in public channel', channelName: 'off-topic', useSlashCommand: false},
        {label: 'post menu in private channel', channelName: '', useSlashCommand: false},
    ];

    for (const c of cases) {
        /**
         * @objective Starting a run via {entry point} from {channel type} succeeds: the
         * Interactive Run Dialog opens, a run name can be entered, confirming creates an active
         * run (verified via API), and the page navigates to the run's linked channel.
         *
         * Both entry points call startPlaybookRun → /playbook run slash command →
         * Mattermost interactive dialog (apps modal), not the plugin's custom RunModal.
         *
         * @precondition User is the owner of the seeded playbook (created by the user).
         */
        test(`start run via ${c.label}`, {tag: '@playbooks'}, async ({page}) => {
            const mm = new MattermostCore(page);
            const dialog = mm.interactiveRunDialog;

            // # Log in and navigate to the target channel
            await loginAs(page, user.username, user.password);
            const channelName = c.channelName || privateChannelName;
            await mm.channels.goto(teamName, channelName);

            const runName = `Run ${c.label.replace(/ /g, '-')} ${uniqueSuffix()}`;

            if (c.useSlashCommand) {
                // # Trigger the run-creation dialog via the slash command
                await mm.channels.runSlashCommand('/playbook run');
            } else {
                // # Post a regular message so the post menu is available on a real post
                await mm.channels.postMessage(`test post ${uniqueSuffix()}`);
                // # Open the post-level "actions" dropdown and click "Run playbook"
                await mm.postList.runPlaybookFromLastPost();
            }

            // * The Interactive Run Dialog (apps modal) should be visible
            await dialog.expectOpen();

            // # Fill in a unique run name
            // (playbook is auto-selected when the user has exactly one playbook)
            await dialog.setRunName(runName);

            // # Submit — click "Start run"
            await dialog.submit();

            // * The dialog closes after submission
            await dialog.expectClosed();

            // * The page navigates to the run's linked channel (websocket event navigates here)
            await expect(page).toHaveURL(new RegExp(`/${teamName}/channels/`));

            // * The run is active — verified via REST API (end_at === 0)
            const run = await getRunByName(page, teamId, runName);
            expect(run, `run "${runName}" should exist`).toBeDefined();
            expect(run!.current_status).not.toBe('Finished');
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Entry point: playbook list "Run" button → custom RunModal
// ─────────────────────────────────────────────────────────────────────────────

test.describe('run start entry point: playbook list', () => {
    let teamName: string;
    let user: SeededUser;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);
        const team = await createTeam(page, 'run-list-entry');
        const u = await createUser(page, 'run-list-user');
        await addUserToTeam(page, team.id, u.id);

        // Log in as the user to create the playbook (user becomes owner/member automatically)
        await loginAs(page, u.username, u.password);
        await createPlaybook(page, team.id, `List Entry PB ${uniqueSuffix()}`);

        teamName = team.name;
        user = u;

        await context.close();
    });

    /**
     * @objective The "Run" button in the backstage playbook list opens the plugin's custom
     * RunModal; confirming with a filled run name navigates to the Run Details Page with the
     * ?from=run_modal query parameter and shows the correct run name in the page heading.
     *
     * Port of: playbooks/start_run_spec.js "from playbook list > defaults"
     */
    test('Run button opens modal and confirmed run lands on RDP', {tag: '@playbooks'}, async ({page}) => {
        const playbooksPage = new PlaybooksPage(page);
        const rdp = new RunDetailsPage(page);
        const modal = new RunModal(page);

        // # Log in and navigate to the backstage playbook list
        await loginAs(page, user.username, user.password);
        await playbooksPage.goto(teamName);
        await playbooksPage.openPlaybooksList();

        // # Click the "Run" button on the first (only) playbook row
        await playbooksPage.clickRunForFirstPlaybook();

        // * The custom RunModal should open (dialog visible)
        await modal.expectOpen();

        // # Fill the run name
        const runName = `List Run ${uniqueSuffix()}`;
        await modal.setRunName(runName);

        // # Confirm
        await modal.submit();

        // * Page navigates to the RDP with ?from=run_modal
        await expect(page).toHaveURL(/\/playbooks\/runs\//);
        await expect(page).toHaveURL(/from=run_modal/);
        await rdp.header.waitFor();

        // * The RDP heading shows the run name
        await rdp.expectTitle(runName);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Entry point: playbook editor "Run Playbook" — own team and cross-team
// Uses the custom RunModal (not the interactive dialog).
// ─────────────────────────────────────────────────────────────────────────────

test.describe('run start entry point: playbook editor (own and cross-team)', () => {
    let ownTeam: Team;
    let otherTeam: Team;
    let user: SeededUser;
    let playbook: Playbook;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);
        ownTeam = await createTeam(page, 'run-editor-own');
        otherTeam = await createTeam(page, 'run-editor-other');
        user = await createUser(page, 'run-editor-user');
        await addUserToTeam(page, ownTeam.id, user.id);
        await addUserToTeam(page, otherTeam.id, user.id);

        // Log in as the user to create the playbook (user becomes owner/member automatically)
        await loginAs(page, user.username, user.password);

        // Playbook lives on ownTeam; tested from both own and other team's context
        playbook = await createPlaybook(page, ownTeam.id, `Editor PB ${uniqueSuffix()}`);

        await context.close();
    });

    /**
     * @objective Clicking "Run Playbook" in the playbook editor opens the custom RunModal
     * regardless of whether the user is browsing from the playbook's own team or a different
     * team (cross-team navigation). The own-team case completes a run and verifies it appears
     * in the Playbooks LHS "Runs" section — covering overview_spec.js > "start a run". The
     * cross-team case verifies the modal opens (then cancels). Consolidated per P3:
     * "overview_spec cross-team: 4 variants → 2".
     *
     * Port of: playbooks/overview_spec.js "should switch to channels and prompt to run" ×5
     *          playbooks/overview_spec.js "start a run"
     *          playbooks/overview_spec.js "start a run > create a new channel"
     */
    test(
        'Run Playbook button opens modal from own team and cross-team contexts',
        {tag: '@playbooks'},
        async ({page}) => {
            const editor = new PlaybookEditorPage(page);
            const modal = new RunModal(page);
            const playbooksPage = new PlaybooksPage(page);

            // # Log in
            await loginAs(page, user.username, user.password);

            // ── Case 1: own-team — open modal, create run, verify in LHS ──────
            await editor.goto(ownTeam.name, playbook.id);
            await editor.openRunModal();

            // * The custom RunModal is visible from the own team context
            await modal.expectOpen();

            // # Fill a unique run name and confirm
            const runName = `Editor Own-Team Run ${uniqueSuffix()}`;
            await modal.setRunName(runName);
            await modal.submit();

            // * Page navigates to the Run Details Page (custom RunModal navigates here)
            await expect(page).toHaveURL(/\/playbooks\/runs\//i);

            // * The new run appears in the Playbooks LHS "Runs and Checklists" section.
            //   Covers overview_spec.js > "start a run":
            //   cy.findByTestId('Runs').findByTestId(runName).should('exist')
            await playbooksPage.openRunsList();
            await playbooksPage.expectRunVisible(runName);

            // ── Case 2: cross-team — visit from other team, verify modal opens ─
            // Visit a channel on the other team to establish its context,
            // then navigate directly to the playbook editor URL (which belongs to ownTeam).
            await page.goto(`/${otherTeam.name}/channels/town-square`);
            await page.goto(`/playbooks/playbooks/${playbook.id}/outline`);
            await editor.title.waitFor();

            await editor.openRunModal();

            // * The custom RunModal is visible even from the other-team context
            await modal.expectOpen();
            await modal.cancel();
            await modal.expectClosed();
        },
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Channel admin: run creator gets channel-admin rights
// Uses the Interactive Run Dialog (slash command flow).
// ─────────────────────────────────────────────────────────────────────────────

test.describe('run creator becomes channel admin', () => {
    let teamName: string;
    let user: SeededUser;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);
        const team = await createTeam(page, 'run-admin');
        const u = await createUser(page, 'run-admin-user');
        await addUserToTeam(page, team.id, u.id);

        // Log in as the user to create the playbook (user becomes owner/member automatically)
        await loginAs(page, u.username, u.password);
        await createPlaybook(page, team.id, `Admin PB ${uniqueSuffix()}`);

        teamName = team.name;
        user = u;

        await context.close();
    });

    /**
     * @objective The user who starts a run via the slash command becomes channel admin of the
     * newly created run channel. Verified by opening Channel Settings and confirming the
     * channel-header textbox is editable (only channel admins can edit the channel header).
     *
     * Port of: channels/run_spec.js "always as channel admin"
     */
    test('user who starts a run is channel admin of the run channel', {tag: '@playbooks'}, async ({page}) => {
        const mm = new MattermostCore(page);
        const dialog = mm.interactiveRunDialog;

        // # Log in and navigate to a public channel
        await loginAs(page, user.username, user.password);
        await mm.channels.goto(teamName, 'off-topic');

        // # Start a run via the slash command (opens the interactive dialog)
        await mm.channels.runSlashCommand('/playbook run');
        await dialog.expectOpen();

        // # Fill the run name and submit
        const runName = `Admin Run ${uniqueSuffix()}`;
        await dialog.setRunName(runName);
        await dialog.submit();
        await dialog.expectClosed();

        // * Page navigated to the run's channel
        await expect(page).toHaveURL(new RegExp(`/${teamName}/channels/`));

        // # Open Channel Settings via the channel header dropdown
        await mm.channels.openChannelSettings();

        // * Channel Settings dialog is open and the header textbox is editable,
        //   which confirms the current user has channel-admin rights
        await mm.channels.expectChannelHeaderEditable();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Interactive run dialog: validation and metadata (slash command flow)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('interactive run dialog: validation and metadata', () => {
    let teamName: string;
    let teamId: string;
    let user: SeededUser;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);
        const team = await createTeam(page, 'run-dialog');
        const u = await createUser(page, 'run-dialog-user');
        await addUserToTeam(page, team.id, u.id);

        // Log in as the user to create TWO playbooks.
        // Two playbooks prevent auto-selection in the interactive dialog, exposing the
        // playbook-selector and enabling the "required fields" validation test.
        await loginAs(page, u.username, u.password);
        await createPlaybook(page, team.id, `Dialog PB A ${uniqueSuffix()}`);
        await createPlaybook(page, team.id, `Dialog PB B ${uniqueSuffix()}`);

        teamName = team.name;
        teamId = team.id;
        user = u;

        await context.close();
    });

    /**
     * @objective Submitting the Interactive Run Dialog with all required fields empty keeps
     * the dialog open and shows "This field is required." on both the Playbook selector and
     * the Run name field. Two playbooks are seeded so the dialog cannot auto-select and skip
     * the playbook-selector field validation.
     *
     * Port of: channels/run_dialog_spec.js
     *          "cannot create a playbook run without filling required fields"
     */
    test('required empty fields show validation errors on submit', {tag: '@playbooks'}, async ({page}) => {
        const mm = new MattermostCore(page);
        const dialog = mm.interactiveRunDialog;

        // # Log in and navigate to a channel
        await loginAs(page, user.username, user.password);
        await mm.channels.goto(teamName, 'off-topic');

        // # Trigger the dialog via the slash command
        // With TWO playbooks available the dialog cannot auto-select one, so both the
        // playbook-selector and the run-name field are empty and required.
        await mm.channels.runSlashCommand('/playbook run');
        await dialog.expectOpen();

        // # Click submit without filling any required fields
        await dialog.submit();

        // * The dialog stays open (validation failed)
        await dialog.expectOpen();

        // * "This field is required." appears on the Playbook selector
        await dialog.expectPlaybookRequired();

        // * "This field is required." appears on the Run name field
        await dialog.expectRunNameRequired();

        // # Clean up
        await dialog.cancel();
        await dialog.expectClosed();
    });

    /**
     * @objective The Interactive Run Dialog opened via the slash command shows the current
     * user's display name as owner (in the intro text "**Owner** username") and the "Run name"
     * label. Cancelling the dialog closes it and does not create a run (verified via REST API).
     *
     * Port of: channels/run_dialog_spec.js "shows expected metadata" and
     *          channels/run_dialog_spec.js "is canceled when cancel is clicked"
     */
    test('dialog shows owner name and cancelling creates no run', {tag: '@playbooks'}, async ({page}) => {
        const mm = new MattermostCore(page);
        const dialog = mm.interactiveRunDialog;

        // # Log in and navigate to a channel
        await loginAs(page, user.username, user.password);
        await mm.channels.goto(teamName, 'off-topic');

        // # Trigger the dialog via the slash command
        await mm.channels.runSlashCommand('/playbook run');
        await dialog.expectOpen();

        // * Dialog shows the user's display name as owner in the intro text
        //   (for seeded users, first_name = username, so username appears in the intro)
        await dialog.expectContainsText(user.username);

        // * Dialog shows the "Run name" label
        await dialog.expectRunNameLabelVisible();

        // # Type a unique name (used later for the API verification)
        const runName = `Dialog Cancel Run ${uniqueSuffix()}`;
        await dialog.setRunName(runName);

        // # Cancel the dialog
        await dialog.cancel();
        await dialog.expectClosed();

        // * No run with the typed name was created (API verification)
        const run = await getRunByName(page, teamId, runName);
        expect(run, 'cancelled run should NOT exist in the API').toBeUndefined();
    });

    /**
     * @objective Submitting the Interactive Run Dialog with a whitespace-only run name.
     *
     * @fixme The legacy Cypress spec `run_dialog_spec.js > rejects invalid channel names`
     * expected the interactive dialog to reject whitespace names with an "unable to create
     * playbook run" error in `div.error-text`. The server now trims whitespace names to ""
     * and falls back to "Untitled" rather than returning an error. The "invalid channel name"
     * rejection behavior no longer exists.
     *
     * See: e2e-tests/cypress/tests/integration/playbooks/channels/run_dialog_spec.js
     *      "rejects invalid channel names"
     */
    test.fixme(
        'whitespace-only run name is rejected (obsolete: server now converts it to Untitled)',
        {tag: '@playbooks'},
        async ({page}) => {
            // NOTE: In the legacy behavior, submitting '  ' showed "unable to create playbook run".
            // The server now trims and falls back to "Untitled". No rejection occurs.
            void page;
        },
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Keyword trigger: "Yes, run playbook" prompt → Interactive Run Dialog
// ─────────────────────────────────────────────────────────────────────────────

test.describe('keyword trigger: prompt to run playbook', () => {
    let teamName: string;
    let user: SeededUser;
    let triggerChannel: Channel;
    let keyword: string;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);
        const team = await createTeam(page, 'run-keyword');
        const u = await createUser(page, 'run-keyword-user');
        await addUserToTeam(page, team.id, u.id);

        // Log in as the user to create the playbook and channel action (user becomes member)
        await loginAs(page, u.username, u.password);
        const userId = (await getCurrentUser(page)).id;

        const pb = await createPlaybook(page, team.id, `Keyword PB ${uniqueSuffix()}`);

        // Create a dedicated channel for the keyword-trigger test
        const tc = await createChannel(page, team.id, {displayName: 'Keyword Trigger Channel'});

        // Add the user to the trigger channel
        await page.request.post(`/api/v4/channels/${tc.id}/members`, {
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            data: {user_id: userId},
        });

        const kw = `sev-alert-${uniqueSuffix()}`;

        // Create the "Prompt to run a playbook" channel action via the Playbooks REST API
        await createKeywordRunPlaybookAction(page, tc.id, [kw], pb.id);

        teamName = team.name;
        user = u;
        triggerChannel = tc;
        keyword = kw;
        void pb; // playbook auto-selected in interactive dialog (single playbook)

        await context.close();
    });

    /**
     * @objective When a keyword-triggered "Prompt to run a playbook" channel action fires,
     * the bot posts a prompt containing a "Yes, run playbook" action button. Clicking it opens
     * the Interactive Run Dialog; confirming creates a run that appears as the active run title
     * in the Playbooks channel RHS.
     *
     * Port of: channels/general_actions_spec.js "keyword trigger > prompt to run playbook
     *          can be enabled and works" (only the "Yes, run playbook" → dialog → RHS part)
     */
    test(
        'clicking Yes, run playbook opens dialog and created run appears in RHS',
        {tag: '@playbooks'},
        async ({page}) => {
            const mm = new MattermostCore(page);
            const dialog = mm.interactiveRunDialog;
            const rhs = new ChannelRhs(page);

            // # Log in and navigate to the trigger channel
            await loginAs(page, user.username, user.password);
            await mm.channels.goto(teamName, triggerChannel.name);

            // # Post the trigger keyword
            await mm.channels.postMessage(keyword);

            // * Bot posts a prompt containing "trigger for" and our playbook name
            await mm.postList.expectLastPostContains('trigger for');

            // # Click "Yes, run playbook" in the bot prompt post
            await mm.postList.clickYesRunPlaybook();

            // * The Interactive Run Dialog opens
            await dialog.expectOpen();

            // # Enter a run name and start the run
            const runName = `Keyword Run ${uniqueSuffix()}`;
            await dialog.setRunName(runName);
            await dialog.submit();

            // * Dialog closes
            await dialog.expectClosed();

            // * The page navigates to the run channel (keyword trigger routes to the channel)
            await expect(page).toHaveURL(new RegExp(`/${teamName}/channels/`));

            // * The Playbooks RHS auto-opens and shows the new run name
            await rhs.title.waitFor();
            await rhs.expectRunTitle(runName);


        },
    );
});
