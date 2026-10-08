// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Playwright port of:
//   e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_spec.js
//     (all except "from playbook list > defaults" → start-run-entry-points task)
//   e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_template_spec.js
//     (UI tests only; two "backend ignores client-supplied name" API tests → go-coverage-gaps)
//   e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_new_channel_only_spec.js
//     (the "when new_channel_only is true/false" run-modal tests)
//   e2e-tests/cypress/tests/integration/playbooks/runs/new_channel_enforcement_spec.js
//     (the 2 "UI run start" tests only)
//   e2e-tests/cypress/tests/integration/playbooks/channels/rhs/start_run_rhs_spec.js
//     (non-skipped tests: create-new-playbook from modal, DM/GM exclusion, DM refetch flood)

import {test, expect} from '@playwright/test';

import {loginAs, loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {createChannel, createDirectChannel, createGroupChannel, searchChannels} from '../helpers/channel';
import {
    archivePlaybook,
    createPlaybook,
    updatePlaybook,
    patchPlaybook,
    addPlaybookPropertyField,
} from '../helpers/playbook';
import {getRun} from '../helpers/run';
import {addUserToTeam, createTeam} from '../helpers/team';
import {createUser, getCurrentUser, type SeededUser} from '../helpers/user';
import {ChannelRhs} from '../pages/channel_rhs';
import {PlaybookEditorPage} from '../pages/playbook_editor_page';
import {RunDetailsPage} from '../pages/run_details_page';
import {RunModal} from '../pages/run_modal';

const RUN_NAME_MAX_LENGTH = 64;

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

interface SeededData {
    teamName: string;
    teamId: string;
    user: SeededUser;
    userId: string;
}

test.describe('run creation modal', () => {
    let seededData: SeededData;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);
        const team = await createTeam(page, 'run-modal');
        const user = await createUser(page, 'run-modal-user');
        await addUserToTeam(page, team.id, user.id);

        // Log in as the user once to capture the user id easily
        await loginAs(page, user.username, user.password);
        const currentUser = await getCurrentUser(page);

        seededData = {
            teamName: team.name,
            teamId: team.id,
            user,
            userId: currentUser.id,
        };

        await context.close();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Channel mode configuration tests
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @objective Verify the run modal prefills run name and summary from the playbook's
     * channel_name_template and run_summary_template when the editor is opened.
     *
     * @precondition
     * The playbook is configured with create_new_channel mode, a channel_name_template,
     * a run_summary_template, and default_owner_enabled.
     */
    test('prefills run name and summary from channel and summary templates', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        // # Log in and create a playbook
        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Template Prefill ${uniqueSuffix()}`);

        // # Configure it with a channel template, summary template, and default owner
        await updatePlaybook(page, playbook.id, {
            ...playbook,
            channel_name_template: 'Channel template',
            channel_mode: 'create_new_channel',
            run_summary_template: 'run summary template',
            run_summary_template_enabled: true,
            default_owner_enabled: true,
            default_owner_id: seededData.userId,
        });

        // # Open the playbook editor then open the run modal
        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * Assert template name is prefilled and summary is prefilled
        await modal.expectRunNameValue('Channel template');
        await modal.expectSummaryValue('run summary template');

        // # Start the run
        await modal.submit();

        // * Verify we land on RDP with ?from=run_modal and the templated run name
        await expect(page).toHaveURL(/\/playbooks\/runs\/.*\?from=run_modal/);
        await rdp.header.waitFor();
        await rdp.expectTitle('Channel template');

        // * Verify the summary is shown on the RDP
        await expect(rdp.summarySection).toContainText('run summary template');

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify the user can override the prefilled run name and summary in the
     * run modal before starting the run.
     */
    test('user can override prefilled run name and summary', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Override ${uniqueSuffix()}`);

        await updatePlaybook(page, playbook.id, {
            ...playbook,
            channel_mode: 'create_new_channel',
            run_summary_template: 'run summary template',
            run_summary_template_enabled: true,
        });

        // # Open the editor and launch the run modal
        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * Summary is prefilled from the template
        await modal.expectSummaryValue('run summary template');

        // # Override both the name and the summary
        await modal.setRunName('Test Run Name');
        await modal.setSummary('Test Run Summary');

        // # Submit
        await modal.submit();

        // * RDP shows the overridden values
        await expect(page).toHaveURL(/\/playbooks\/runs\/.*\?from=run_modal/);
        await rdp.header.waitFor();
        await rdp.expectTitle('Test Run Name');
        await expect(rdp.summarySection).toContainText('Test Run Summary');

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify that switching to "Link to existing channel" does NOT auto-fill the
     * channel when the modal is opened via direct navigation (no prior channel context).
     */
    test('switching to link-existing shows empty selector when no channel context', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW No Default ${uniqueSuffix()}`);
        await updatePlaybook(page, playbook.id, {
            ...playbook,
            channel_name_template: 'Channel template',
            channel_mode: 'create_new_channel',
            default_owner_enabled: true,
            default_owner_id: seededData.userId,
        });

        // # Navigate directly to the editor (no prior channel visit, so Redux currentChannelId
        // # is not set — the run modal won't auto-fill any channel when switching modes)
        await editor.gotoDirectly(playbook.id);
        await editor.openRunModal();

        // # Switch to link-existing channel mode
        await modal.chooseLinkExistingChannel();

        // * The channel selector shows the placeholder (no channel is auto-selected)
        await modal.expectChannelSelectorPlaceholder('Select a channel');

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify that switching to "Link to existing channel" defaults to the current
     * channel when the editor is reached via client-side navigation from a channel.
     * This preserves the Redux currentChannelId set by visiting the channel.
     */
    test('switching to link-existing defaults to current channel after client-side nav', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Link Default ${uniqueSuffix()}`);

        // # Navigate to the editor via Town Square client-side (preserves Redux currentChannelId)
        await editor.gotoViaClientSideNav(seededData.teamName, playbook.id);

        // # Open the run modal
        await editor.openRunModal();
        await modal.expectOpen();

        // # Switch to link-existing channel mode
        await modal.chooseLinkExistingChannel();

        // * Town Square is pre-selected because it was the active Redux channel
        await modal.expectChannelSelectorPlaceholder('Town Square');

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify run creation with "Link to existing channel" mode:
     * the confirm button is disabled until a channel is selected; selecting a
     * channel enables it; the created run's channel link navigates to that channel.
     */
    test('link-existing mode: confirm disabled until channel selected; run links to chosen channel', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Link Existing ${uniqueSuffix()}`);
        await updatePlaybook(page, playbook.id, {
            ...playbook,
            channel_mode: 'create_new_channel',
            run_summary_template: 'run summary template',
            run_summary_template_enabled: true,
            default_owner_enabled: true,
            default_owner_id: seededData.userId,
        });

        // # Navigate directly to editor (no town-square visit) so no current channel is in Redux.
        // # This ensures the run modal doesn't auto-fill a channel when switching to link-existing.
        await editor.gotoDirectly(playbook.id);
        await editor.openRunModal();

        // # Switch to link-existing
        await modal.chooseLinkExistingChannel();

        // # Fill run name
        await modal.setRunName('Test Run Name');

        // * Confirm disabled before channel selected
        await modal.expectSubmitDisabled();

        // # Select Town Square
        await modal.selectChannel('Town');

        // * Confirm now enabled
        await modal.expectSubmitEnabled();

        // # Start the run
        await modal.submit();

        // * Land on RDP
        await expect(page).toHaveURL(/\/playbooks\/runs\/.*\?from=run_modal/);
        await rdp.header.waitFor();
        await rdp.expectTitle('Test Run Name');

        // # Click the channel link in the RDP info sidebar
        await rdp.clickChannelLink();

        // * We navigated to Town Square
        await expect(page).toHaveURL(new RegExp(`/${seededData.teamName}/channels/town-square`));

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify run creation when the playbook is pre-configured with
     * link_existing_channel mode: the modal shows an empty name field (summary prefilled),
     * confirm is disabled until name is entered, and after creation the channel link works.
     * Also verifies switching from link-existing to create-new creates a new channel.
     */
    test('link-existing pre-configured: must fill name; channel link navigates correctly', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Link Pre ${uniqueSuffix()}`);

        // # Find Town Square's ID to pre-link it
        const [townSquare] = await searchChannels(page, seededData.teamId, 'Town Square');

        await updatePlaybook(page, playbook.id, {
            ...playbook,
            channel_mode: 'link_existing_channel',
            channel_id: townSquare.id,
            run_summary_template: 'run summary template',
            run_summary_template_enabled: true,
        });

        // # Open the editor → run modal
        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * Run name is empty (link-existing mode doesn't prefill)
        await modal.expectRunNameValue('');

        // * Summary is prefilled from template
        await modal.expectSummaryValue('run summary template');

        // * Confirm disabled (no name entered yet)
        await modal.expectSubmitDisabled();

        // # Fill run name
        await modal.setRunName('Test Run Name');

        // # Submit
        await modal.submit();

        // * Land on RDP
        await expect(page).toHaveURL(/\/playbooks\/runs\/.*\?from=run_modal/);
        await rdp.header.waitFor();
        await rdp.expectTitle('Test Run Name');
        await expect(rdp.summarySection).toContainText('run summary template');

        // # Click channel link
        await rdp.clickChannelLink();

        // * Navigates to town-square
        await expect(page).toHaveURL(new RegExp(`/${seededData.teamName}/channels/town-square`));

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify that switching from link-existing to create-new in the run modal
     * creates a new channel named after the run name entered.
     */
    test('switching from link-existing to create-new creates a new channel', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Switch Mode ${uniqueSuffix()}`);

        // # Find Town Square's ID to pre-link it in link-existing mode
        const [townSquare] = await searchChannels(page, seededData.teamId, 'Town Square');

        await updatePlaybook(page, playbook.id, {
            ...playbook,
            channel_mode: 'link_existing_channel',
            channel_id: townSquare.id,
            run_summary_template: 'run summary template',
            run_summary_template_enabled: true,
        });

        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // # Switch to create-new channel
        await modal.chooseCreateChannel();

        // # Fill run name
        await modal.setRunName('test-run-name');

        // # Start the run
        await modal.submit();

        // * Land on RDP
        await expect(page).toHaveURL(/\/playbooks\/runs\/.*\?from=run_modal/);
        await rdp.header.waitFor();
        await rdp.expectTitle('test-run-name');

        // # Click channel link
        await rdp.clickChannelLink();

        // * We are on the new channel (named after the run)
        await expect(page).toHaveURL(new RegExp(`/${seededData.teamName}/channels/test-run-name`));

        await archivePlaybook(page, playbook.id);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Validation tests
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @objective Validate run name input: empty disables submit; exactly-max accepted with no
     * error; over-max shows an error mentioning the limit and disables submit; one backspace clears
     * the error.
     */
    test('validation: empty disables submit; max length accepted; over max shows recoverable error', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Validation ${uniqueSuffix()}`);

        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * Empty name → submit disabled
        await modal.expectRunNameValue('');
        await modal.expectSubmitDisabled();

        // # Type exactly the maximum allowed length
        await modal.setRunName('a'.repeat(RUN_NAME_MAX_LENGTH));

        // * No error, submit enabled
        await modal.expectNoNameError();
        await modal.expectSubmitEnabled();

        // # Append one more character to exceed the limit
        await modal.runNameInput.press('End');
        await modal.runNameInput.type('a');

        // * Error shown with the max length mentioned, submit disabled
        await modal.expectNameErrorContains(String(RUN_NAME_MAX_LENGTH));
        await modal.expectSubmitDisabled();

        // # Remove the extra character
        await modal.runNameInput.press('Backspace');

        // * Error cleared, submit enabled again
        await modal.expectNoNameError();
        await modal.expectSubmitEnabled();
    });

    /**
     * @objective Verify that cancelling the run modal discards any entered values;
     * reopening shows empty fields (no template configured on this playbook).
     */
    test('cancel resets form fields', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Cancel Reset ${uniqueSuffix()}`);

        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // # Fill in custom values
        await modal.setRunName('Custom Run Name');
        await modal.setSummary('Custom Summary');

        // # Cancel the modal
        await modal.cancel();
        await modal.expectClosed();

        // # Reopen
        await editor.openRunModal();

        // * Fields are reset (no template configured, so defaults are empty)
        await modal.expectRunNameValue('');
        await modal.expectSummaryValue('');

        await archivePlaybook(page, playbook.id);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Run name template tests
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @objective Verify locked {OWNER} and literal locked templates: the run-name field is
     * read-only, the submit button is enabled (name is not required), and submitting creates
     * a run whose name has the token resolved (not the literal "{OWNER}" string).
     * Literal locked templates have no preview shown.
     */
    test('locked template: readonly field + submit enabled; token resolves in created run', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);

        // --- Part 1: {OWNER} token locked ---
        const ownerPlaybook = await createPlaybook(page, seededData.teamId, `PW Locked OWNER ${uniqueSuffix()}`);
        await patchPlaybook(page, ownerPlaybook.id, {
            channel_name_template: '{OWNER}',
            channel_name_template_locked: true,
        });

        await editor.goto(seededData.teamName, ownerPlaybook.id);
        await editor.openRunModal();

        // * Field is readonly and prefilled with the raw template text
        await modal.expectRunNameValue('{OWNER}');
        await modal.expectRunNameReadOnly();

        // * Submit is enabled (locked template drives naming, no required fields)
        await modal.expectSubmitEnabled();

        // # Submit
        await modal.submit();

        // * The run name does not contain the literal "{OWNER}" — it was resolved server-side
        await expect(page).toHaveURL(/\/playbooks\/runs\//);
        await rdp.header.waitFor();
        const runUrl = page.url();
        const runId = runUrl.split('/playbooks/runs/')[1]?.split('?')[0];
        const run = await getRun(page, runId!);
        expect(run.name).not.toContain('{OWNER}');
        expect(run.name.length).toBeGreaterThan(0);

        await archivePlaybook(page, ownerPlaybook.id);

        // --- Part 2: literal locked template has no preview ---
        const literalPlaybook = await createPlaybook(page, seededData.teamId, `PW Locked Literal ${uniqueSuffix()}`);
        await patchPlaybook(page, literalPlaybook.id, {
            channel_name_template: 'Incident War Room',
            channel_name_template_locked: true,
        });

        await editor.goto(seededData.teamName, literalPlaybook.id);
        await editor.openRunModal();

        await modal.expectRunNameValue('Incident War Room');
        await modal.expectRunNameReadOnly();
        await modal.expectNoPreview();
        await modal.expectSubmitEnabled();

        await archivePlaybook(page, literalPlaybook.id);
    });

    /**
     * @objective Verify unlocked template: the name field is editable and prefilled with the
     * raw template text; a preview shows the resolved value; clearing the field disables submit;
     * a typed custom name overrides the template in the created run; typing a freehand {OWNER}
     * token also resolves in the preview.
     */
    test('unlocked template: editable + preview; typed name overrides template; freehand token resolves', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Unlocked ${uniqueSuffix()}`);
        await patchPlaybook(page, playbook.id, {
            channel_name_template: '{OWNER} - Incident',
        });

        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * Field is editable (not readonly) and prefilled with the raw template
        await modal.expectRunNameValue('{OWNER} - Incident');
        await modal.expectRunNameEditable();

        // * Preview shows the resolved value — not the raw {OWNER} syntax
        await modal.expectPreviewContains('Incident');
        await modal.expectPreviewNotContains('{OWNER}');

        // * Submit is enabled with the prefilled default
        await modal.expectSubmitEnabled();

        // # Clear the name → submit disabled
        await modal.setRunName('');
        await modal.expectSubmitDisabled();

        // # Type a freehand {OWNER} token and verify preview resolves it
        await modal.setRunName('Kickoff by {OWNER}');
        await modal.expectPreviewContains('Kickoff by');
        await modal.expectPreviewNotContains('{OWNER}');

        // # Type a custom name (overrides the template)
        const customName = `My Custom Run ${uniqueSuffix()}`;
        await modal.setRunName(customName);

        // # Submit
        await modal.expectSubmitEnabled();
        await modal.submit();

        // * RDP shows the typed name
        await expect(page).toHaveURL(/\/playbooks\/runs\//);
        await rdp.header.waitFor();
        await rdp.expectTitle(customName);

        // * Backend stored the typed name (not the template)
        const runUrl = page.url();
        const runId = runUrl.split('/playbooks/runs/')[1]?.split('?')[0];
        const run = await getRun(page, runId!);
        expect(run.name).toBe(customName);

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify that a locked template whose resolved name exceeds 64 characters shows
     * an inline error mentioning the limit and disables the submit button.
     */
    test('template too long: preview error shown and submit disabled', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Long Template ${uniqueSuffix()}`);

        // A 65-char literal + {SEQ} exceeds the 64-char run name limit when resolved.
        // The template must be locked (override not allowed) — a literal template that
        // allows override would never hit this validation path.
        await patchPlaybook(page, playbook.id, {
            channel_name_template: 'x'.repeat(65) + '{SEQ}',
            channel_name_template_locked: true,
        });

        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * Inline error mentions the 64-character limit
        await modal.expectPreviewErrorContains('64');

        // * Submit disabled
        await modal.expectSubmitDisabled();

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify that the Cancel button remains visible and clickable when the
     * run modal shows many property-field "Attributes" inputs.
     */
    test('many attribute fields: Cancel button remains reachable', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Many Fields ${uniqueSuffix()}`);

        const fieldNames = ['Priority', 'Region', 'Team', 'Environment'];
        for (let i = 0; i < fieldNames.length; i++) {
            await addPlaybookPropertyField(page, playbook.id, {
                name: fieldNames[i],
                type: 'text',
                attrs: {visibility: 'always', sortOrder: i},
            });
        }

        const template = fieldNames.map((n) => `{${n}}`).join(' - ');
        await patchPlaybook(page, playbook.id, {channel_name_template: template});

        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * The Attributes section is rendered (property fields wired to template tokens)
        await expect(modal.attributesSectionHeader).toBeVisible();

        // * Cancel button is visible within the viewport — not pushed off-screen
        await expect(modal.cancelButton).toBeVisible();

        // # Click Cancel — modal closes without creating a run
        await modal.cancel();
        await modal.expectClosed();

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify free-text (no template) mode: the name field is editable, there is
     * no "(optional)" label, no preview, and no Attributes section. Empty name disables submit;
     * typing a name enables it and the run is created with that name.
     */
    test('no-template free-text: editable name required; creates run with typed name', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW No Template ${uniqueSuffix()}`);

        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * Name field is editable (no readonly)
        await modal.expectRunNameEditable();

        // * No "(optional)" label (name is required in free-text mode)
        await modal.expectNoOptionalLabel();

        // * No preview shown
        await modal.expectNoPreview();

        // * No Attributes section shown
        await modal.expectNoAttributesSection();

        // * Submit disabled with empty name
        await modal.expectRunNameValue('');
        await modal.expectSubmitDisabled();

        // # Type a name
        const runName = `Manual Run ${uniqueSuffix()}`;
        await modal.setRunName(runName);

        // * Submit enabled
        await modal.expectSubmitEnabled();

        // # Create the run
        await modal.submit();

        // * Land on RDP with the typed run name
        await expect(page).toHaveURL(/\/playbooks\/runs\//);
        await rdp.header.waitFor();
        await rdp.expectTitle(runName);

        // * Backend stored the typed name
        const runUrl = page.url();
        const runId = runUrl.split('/playbooks/runs/')[1]?.split('?')[0];
        const run = await getRun(page, runId!);
        expect(run.name).toBe(runName);

        await archivePlaybook(page, playbook.id);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // new_channel_only enforcement
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @objective Verify that when a playbook has new_channel_only=true, the run modal:
     * - disables the "Link to existing channel" radio
     * - checks and enables the "Create a run channel" radio
     * - shows the enforcement hint message
     * - does not render the channel selector
     * - successfully starts a run (creating a new channel)
     */
    test('new_channel_only=true: enforces create-new mode and runs successfully', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW NewChannelOnly ${uniqueSuffix()}`);
        await updatePlaybook(page, playbook.id, {
            ...playbook,
            new_channel_only: true,
        });

        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * "Link to existing channel" radio is disabled
        await modal.expectLinkExistingChannelRadioDisabled();

        // * "Create a run channel" radio is checked and enabled
        await modal.expectCreateChannelRadioChecked();
        await modal.expectCreateChannelRadioEnabled();

        // * Enforcement hint is visible with the correct text
        await modal.expectNewChannelOnlyHintVisible();
        await expect(modal.newChannelOnlyHint).toContainText('This playbook requires a new channel for each run');

        // * Channel selector is not rendered (only shown when link-existing is active)
        await modal.expectChannelSelectorHidden();

        // # Type a run name and start the run
        const runName = `NewChannelOnly Run ${uniqueSuffix()}`;
        await modal.setRunName(runName);
        await modal.submit();

        // * Land on RDP (run created successfully)
        await expect(page).toHaveURL(/\/playbooks\/runs\//);
        await rdp.header.waitFor();
        await rdp.expectTitle(runName);

        // * API confirms a new channel was created for this run
        const runUrl = page.url();
        const runId = runUrl.split('/playbooks/runs/')[1]?.split('?')[0];
        const run = await getRun(page, runId!);
        expect(run.channel_id.length).toBeGreaterThan(0);

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Regression: when new_channel_only=false, the "Link to existing channel" radio
     * is enabled and the enforcement hint is not shown. The UI start creates a run successfully.
     */
    test('new_channel_only=false: link radio enabled and hint absent', {tag: '@playbooks'}, async ({page}) => {
        const modal = new RunModal(page);
        const editor = new PlaybookEditorPage(page);
        const rdp = new RunDetailsPage(page);

        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `PW Open Channel ${uniqueSuffix()}`);
        // new_channel_only defaults to false; no explicit update needed, but set it explicitly for clarity
        await updatePlaybook(page, playbook.id, {
            ...playbook,
            new_channel_only: false,
        });

        await editor.goto(seededData.teamName, playbook.id);
        await editor.openRunModal();

        // * "Link to existing channel" radio is NOT disabled
        await modal.expectLinkExistingChannelRadioEnabled();

        // * Enforcement hint is absent
        await modal.expectNewChannelOnlyHintHidden();

        // # Start a run via create-new (simpler, avoids channel-selector interaction)
        const runName = `Open Channel Run ${uniqueSuffix()}`;
        await modal.setRunName(runName);
        await modal.submit();

        // * Run created successfully
        await expect(page).toHaveURL(/\/playbooks\/runs\//);
        await rdp.header.waitFor();
        await rdp.expectTitle(runName);

        await archivePlaybook(page, playbook.id);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RHS channel exclusion and create playbook
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @objective Verify that DM and GM channels are excluded from the run modal's
     * "Link to existing channel" selector: searching by a DM/GM partner's username
     * does not surface the DM/GM channel as an option.
     *
     * @precondition
     * A DM (and a GM) exists; a playbook is seeded with link_existing_channel mode.
     * The test table covers {DM, GM} in a single parametrized loop.
     */
    for (const channelKind of ['DM', 'GM'] as const) {
        test(`${channelKind} channel is excluded from the link-existing channel selector`, {tag: '@playbooks'}, async ({page}) => {
            const channelRhs = new ChannelRhs(page);
            const modal = new RunModal(page);

            await loginAs(page, seededData.user.username, seededData.user.password);

            // # Create the excluded channel (DM or GM)
            const partnerA = await createUser(page, 'rhs-dm-partner');
            await addUserToTeam(page, seededData.teamId, partnerA.id);

            let excludedChannelId: string;
            let searchTerm: string;

            if (channelKind === 'DM') {
                const dmChannel = await createDirectChannel(page, seededData.userId, partnerA.id);
                excludedChannelId = dmChannel.id;
                searchTerm = partnerA.username;
            } else {
                const partnerB = await createUser(page, 'rhs-gm-partner');
                await addUserToTeam(page, seededData.teamId, partnerB.id);
                const gmChannel = await createGroupChannel(page, [seededData.userId, partnerA.id, partnerB.id]);
                excludedChannelId = gmChannel.id;
                searchTerm = partnerA.username;
            }

            // # Create a regular channel (needed to ensure RHS list view shows with runs)
            const existingChannel = await createChannel(page, seededData.teamId);

            // # Create a playbook in link-existing mode pre-configured to the regular channel
            const playbook = await createPlaybook(page, seededData.teamId, `PW ${channelKind} Excl ${uniqueSuffix()}`);
            await updatePlaybook(page, playbook.id, {
                ...playbook,
                channel_mode: 'link_existing_channel',
                channel_id: existingChannel.id,
            });

            // # Navigate to the regular channel and open the Playbooks RHS
            await channelRhs.gotoChannelAndOpenRhs(seededData.teamName, existingChannel.name);

            // # Open "Run a playbook" modal from the RHS dropdown
            await channelRhs.startRunFromRhs();
            await modal.expectOpen();

            // # Select the playbook (moves to run-details step)
            await modal.selectPlaybook(playbook.title);

            // # Switch to "Link to existing channel"
            await modal.chooseLinkExistingChannel();
            await modal.expectChannelSelectorVisible();

            // # Search for the DM/GM partner username in the channel selector
            await modal.typeInChannelSelector(searchTerm);

            // * The DM/GM channel does NOT appear in the options (excludeDMGM filters it)
            await modal.expectChannelOptionAbsent(searchTerm);

            // Suppress unused variable warning
            void excludedChannelId;

            await archivePlaybook(page, playbook.id);
        });
    }

    /**
     * @objective Regression: opening the run modal from within a DM does not pre-select
     * the DM channel ("Unknown Channel" is not shown), and does not trigger a flood of
     * GET requests for the DM channel id (fewer than 4 requests in the observation window).
     */
    test('DM: no pre-select and no refetch flood when opening run modal', {tag: '@playbooks'}, async ({page}) => {
        const channelRhs = new ChannelRhs(page);
        const modal = new RunModal(page);

        await loginAs(page, seededData.user.username, seededData.user.password);

        const dmPartner = await createUser(page, 'rhs-flood-partner');
        await addUserToTeam(page, seededData.teamId, dmPartner.id);
        const dmChannel = await createDirectChannel(page, seededData.userId, dmPartner.id);

        const playbook = await createPlaybook(page, seededData.teamId, `PW DM Flood ${uniqueSuffix()}`);
        await updatePlaybook(page, playbook.id, {
            ...playbook,
            channel_mode: 'create_new_channel',
            channel_name_template: `auto-${uniqueSuffix()}`,
        });

        // # Navigate to the DM and open the Playbooks RHS
        await channelRhs.gotoDirectMessageAndOpenRhs(seededData.teamName, dmPartner.username);

        // # Count DM-channel fetches while: opening run modal, selecting playbook, switching to link-existing
        const fetchCount = await channelRhs.countChannelFetchesDuring(
            dmChannel.id,
            async () => {
                await channelRhs.startRunFromRhs();
                await modal.expectOpen();
                await modal.selectPlaybook(playbook.title);
            },
            async () => {
                await modal.chooseLinkExistingChannel();
                await modal.expectChannelSelectorVisible();
                // * No phantom "Unknown Channel" pill (the DM is filtered out)
                await modal.expectNoUnknownChannelPill();
            },
        );

        // * The DM channel was not fetched repeatedly (regression cap: < 4 fetches)
        expect(fetchCount).toBeLessThan(4);

        await archivePlaybook(page, playbook.id);
    });

    /**
     * @objective Verify that clicking "Create new playbook" in the run modal's
     * playbook-selection step opens the Create Playbook modal.
     */
    test('"Create new playbook" link opens the create playbook flow', {tag: '@playbooks'}, async ({page}) => {
        const channelRhs = new ChannelRhs(page);
        const modal = new RunModal(page);

        await loginAs(page, seededData.user.username, seededData.user.password);

        // # Navigate to a regular channel and open the Playbooks RHS
        const channel = await createChannel(page, seededData.teamId);
        await channelRhs.gotoChannelAndOpenRhs(seededData.teamName, channel.name);

        // # Open the run-playbook modal (select-playbook step) from the RHS dropdown
        await channelRhs.startRunFromRhs();
        await modal.expectOpen();

        // * "Create new playbook" button is visible (user has create permission)
        await expect(modal.createNewPlaybookButton).toBeVisible();

        // # Click "Create new playbook"
        await modal.createNewPlaybookButton.click();

        // * The Create Playbook modal opens
        await modal.expectCreatePlaybookDialogOpen();
    });
});
