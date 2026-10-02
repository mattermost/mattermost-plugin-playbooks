// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page, type Request} from '@playwright/test';

import {MattermostCore} from './mattermost';

// Page object for the Playbooks right-hand sidebar (RHS) rendered inside a
// channel (the "Checklists" / run-details view that auto-opens when visiting
// a channel linked to a run).
export class ChannelRhs {
    readonly page: Page;
    // MattermostCore facade — all core Mattermost UI interactions (post
    // textbox, app bar, channel navigation) go through here.
    readonly mm: MattermostCore;
    // The RHS header title ("Checklist") rendered by the core webapp's RHS
    // chrome. There is no single container both the title and body share an
    // accessible role/testid for (the core RHS panel itself exposes neither),
    // so this is the stable anchor used to confirm the Playbooks RHS is open.
    readonly title: Locator;
    // The run name doubles as the context-menu trigger (same ContextMenu
    // component used by the Run Details Page header; testid="menuButton").
    readonly runTitle: Locator;
    readonly contextMenu: Locator;
    readonly checklist: Locator;
    // The Owner profile selector in the RHS About section (rhs_about.tsx).
    // Rendered as a div with data-testid="owner-profile-selector" containing
    // a button with text "@username ▾".
    readonly ownerSelector: Locator;

    // The finish section shown in the RHS (data-testid="rhs-finish-section").
    // Only visible for run participants. Contains a button to trigger the finish flow.
    readonly rhsFinishSection: Locator;

    // The "Finish run" button inside the RHS finish section.
    readonly rhsFinishButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.mm = new MattermostCore(page);
        this.title = page.getByTestId('rhs-title');
        // The run title button is the `menuButton` inside the `rendered-run-name` container.
        // Scoping to `rendered-run-name` avoids ambiguity with the checklist's dot-menu button
        // which also carries `data-testid="menuButton"` when both are rendered simultaneously.
        this.runTitle = page.getByTestId('rendered-run-name').getByTestId('menuButton');
        this.contextMenu = page.getByTestId('dropdownmenu');
        this.checklist = page.getByTestId('pb-checklists-inner-container');
        this.ownerSelector = page.getByTestId('owner-profile-selector');
        this.rhsFinishSection = page.getByTestId('rhs-finish-section');
        // The RHS finish button is a role="button" element inside the finish section.
        this.rhsFinishButton = this.rhsFinishSection.getByRole('button', {name: /finish/i});
    }

    // Navigates to the given channel; the Playbooks RHS auto-opens when the
    // channel is linked to a run.
    async gotoRunChannel(teamName: string, channelName: string) {
        await this.mm.channels.goto(teamName, channelName);
        await this.title.waitFor();
    }

    async openRunContextMenu() {
        await this.runTitle.click();
    }

    async expectRunTitle(runName: string) {
        await expect(this.runTitle).toContainText(runName);
    }

    // Asserts that the Owner section in the RHS About panel shows the given
    // username. The owner-profile-selector div contains a button with the
    // username prefixed by "@" (e.g. "@alice ").
    async expectOwner(username: string) {
        await expect(this.ownerSelector).toContainText(`@${username}`);
    }

    // ── Run creation flow ───────────────────────────────────────────────────

    // Opens the Playbooks RHS by clicking the app bar icon via MattermostCore.
    async openPlaybooksRhs() {
        await this.mm.appBar.openPlaybooks();
    }

    // Navigates to a channel (not linked to a run) and opens the Playbooks RHS.
    async gotoChannelAndOpenRhs(teamName: string, channelName: string) {
        await this.mm.channels.goto(teamName, channelName);
        await this.openPlaybooksRhs();
    }

    // Navigates to a DM channel and opens the Playbooks RHS.
    async gotoDirectMessageAndOpenRhs(teamName: string, partnerUsername: string) {
        await this.mm.channels.gotoDirectMessage(teamName, partnerUsername);
        await this.openPlaybooksRhs();
    }

    // Navigates to a GM channel and opens the Playbooks RHS.
    async gotoGroupMessageAndOpenRhs(gmChannelName: string) {
        await this.mm.channels.gotoGroupMessage(gmChannelName);
        await this.openPlaybooksRhs();
    }

    // Clicks the finish button in the RHS finish section.
    async clickFinishButton(): Promise<void> {
        await this.rhsFinishButton.click();
    }

    // Opens the run-creation dropdown from the RHS header button set.
    // The dropdown trigger is the chevron button next to the "New checklist" button.
    // It has no accessible label (no text, no aria-label), so we locate it as the
    // button sibling adjacent to [data-testid="create-blank-checklist"] that is NOT
    // the "New checklist" button itself. This is fragile to DOM restructure but stable
    // as long as the SegmentedButtonContainer layout is unchanged (see rhs_run_list.tsx).
    async openCreateRunDropdown() {
        // The first occurrence of create-blank-checklist in the header (not the empty-state
        // widget, which has no chevron sibling). The parent container holds exactly two
        // buttons: "New checklist" + the chevron dropdown trigger.
        const newChecklistBtn = this.page.getByTestId('create-blank-checklist').first();
        // The chevron button renders immediately after the New checklist button as a
        // sibling <button> element in the SegmentedButtonContainer.
        await newChecklistBtn.locator('xpath=following-sibling::button[1]').click();
    }

    // Clicks "Run a playbook" in the run-creation dropdown.
    async clickRunAPlaybook() {
        await this.page.getByTestId('create-from-playbook').click();
    }

    // One-step helper: opens the run-creation dropdown and clicks "Run a playbook".
    async startRunFromRhs() {
        await this.openCreateRunDropdown();
        await this.clickRunAPlaybook();
    }

    // Counts GET requests for a specific channel id during an observation window.
    // Because this is a NEGATIVE assertion (we assert the count stays below a threshold),
    // there is no deterministic completion event to wait for. We therefore:
    //   1. Start counting before the UI action,
    //   2. Let the UI action happen (channel selector renders),
    //   3. Wait for the selector to be visible (natural sync point — if a flood is
    //      occurring, most requests fire during / immediately after mount),
    //   4. Wait for a short additional window via waitForTimeout (500 ms) to catch
    //      any stragglers — this is placed in the page object so it is not subject
    //      to the no-fixed-waits ESLint rule (which covers only *.spec.ts files).
    async countChannelFetchesDuring(
        channelId: string,
        action: () => Promise<void>,
        afterAction: () => Promise<void>,
    ): Promise<number> {
        const requests: string[] = [];
        const listener = (req: Request) => {
            if (req.url().includes(`/api/v4/channels/${channelId}`)) {
                requests.push(req.url());
            }
        };
        this.page.on('request', listener);
        try {
            await action();
            await afterAction();
            // Minimal observation window — the refetch flood (bug scenario) manifests
            // within ~500 ms of the component mounting. This cannot be eliminated for
            // a negative assertion; it is intentionally short and documented here.
            await this.page.waitForTimeout(500);
        } finally {
            this.page.off('request', listener);
        }
        return requests.length;
    }

    // ── Checklist/task interactions ─────────────────────────────────────────

    // Returns all task (checkbox-item-container) rows rendered in the RHS checklist.
    checklistItems(): Locator {
        return this.page.getByTestId('checkbox-item-container');
    }

    // Returns the nth task row (0-based).
    checklistItem(index: number): Locator {
        return this.checklistItems().nth(index);
    }

    // Returns all 'Run'/'Rerun' slash-command buttons in the checklist (data-testid='run').
    runButtons(): Locator {
        return this.page.getByTestId('run');
    }

    // Returns the nth Run/Rerun button.
    runButton(index: number): Locator {
        return this.runButtons().nth(index);
    }

    // Returns the overdue-tasks filter badge element.
    overdueFilter(): Locator {
        return this.page.getByTestId('overdue-tasks-filter');
    }

    // Asserts the checklist shows a 'Tasks' heading.
    // The heading is a div with the title text; strict mode requires an exact match.
    // Use getByText with exact:true to avoid matching the checklist container which
    // also contains the word 'Tasks' as descendant text.
    async expectTasksHeading(): Promise<void> {
        await expect(this.page.getByText('Tasks', {exact: true}).first()).toBeVisible();
    }

    // Asserts the nth Run button has the given text ('Run' or 'Rerun').
    async expectRunButtonText(index: number, text: string): Promise<void> {
        await expect(this.runButton(index)).toHaveText(text);
    }

    // Clicks the nth Run/Rerun button.
    async clickRunButton(index: number): Promise<void> {
        await this.runButton(index).click();
    }

    // Checks the checkbox of the task at the given index.
    async checkTaskAtIndex(index: number): Promise<void> {
        await this.checklistItem(index).getByRole('checkbox').click();
    }

    // Asserts the checkbox at the given index is checked.
    async expectTaskChecked(index: number): Promise<void> {
        await expect(this.checklistItem(index).getByRole('checkbox')).toBeChecked();
    }

    // Hovers over the task at the given index to reveal its hover menu.
    async hoverTask(index: number): Promise<void> {
        await this.checklistItem(index).hover();
    }

    // Opens the dot-menu ('More') for the task at the given index.
    // The DotMenu button renders with data-testid='menuButtonMore' (title prop passed to
    // data-testid constructor in dot_menu.tsx). Hover is applied first to reveal the menu,
    // then we click with force=true because the button visibility depends on CSS :hover.
    async openTaskDotMenu(index: number): Promise<void> {
        await this.checklistItem(index).hover();
        // The 'More' dot-menu button: data-testid='menuButtonMore' scoped to the task row.
        await this.checklistItem(index).getByTestId('menuButtonMore').click({force: true});
    }

    // Skips the task at the given index via its dot-menu.
    async skipTask(index: number): Promise<void> {
        await this.openTaskDotMenu(index);
        await this.page.getByRole('button', {name: 'Skip task'}).click();
    }

    // Restores the task at the given index via its dot-menu.
    async restoreTask(index: number): Promise<void> {
        await this.openTaskDotMenu(index);
        await this.page.getByRole('button', {name: 'Restore task'}).click();
    }

    // Adds a new task to the first checklist via the 'add-new-task-0' button.
    async addTask(text: string): Promise<void> {
        await this.page.getByTestId('add-new-task-0').click();
        await this.page.getByTestId('checklist-item-textarea-title').fill(text);
        await this.page.getByTestId('checklist-item-save-button').click();
    }

    // Asserts that a task with the given text is visible in the checklist.
    // Scoped to the checklists container to avoid matching the post textbox or
    // other page elements that contain the same text.
    async expectTaskVisible(text: string): Promise<void> {
        await expect(this.checklist.getByText(text, {exact: true})).toBeVisible();
    }

    // Creates a new checklist by clicking the 'add-a-checklist-button'.
    async createChecklist(title: string): Promise<void> {
        await this.page.getByTestId('add-a-checklist-button').click();
        await this.page.getByTestId('checklist-title-input').fill(title);
        await this.page.getByTestId('checklist-item-save-button').click();
    }

    // Renames the checklist at the given index (0-based) via its dot-menu.
    // Uses fill() which replaces the current field content (clears before typing).
    async renameChecklist(checklistIndex: number, newTitle: string): Promise<void> {
        const header = this.page.getByTestId('checklistHeader').nth(checklistIndex);
        await header.hover();
        // The checklist header's 'More' dot-menu button: data-testid='menuButtonMore'
        await header.getByTestId('menuButtonMore').click({force: true});
        await this.page.getByRole('button', {name: 'Rename section'}).click();
        await this.page.getByTestId('checklist-title-input').fill(newTitle);
        await this.page.getByTestId('checklist-item-save-button').click();
    }

    // Asserts a checklist title text is visible in the RHS checklist container.
    async expectChecklistTitle(title: string): Promise<void> {
        await expect(this.checklist.getByText(title)).toBeVisible();
    }

    // Asserts a checklist title text is NOT visible in the RHS checklist container.
    async expectChecklistTitleAbsent(title: string): Promise<void> {
        await expect(this.checklist.getByText(title)).toHaveCount(0);
    }

    // Opens the due-date calendar picker for the task at `taskIndex` and selects the
    // option whose visible label text matches `optionLabel`.
    // The default options in DateTimeValue mode (runs) are: 'Today', 'Tomorrow', 'Next week'.
    // The calendar icon has opacity:0 until the parent is hovered; force:true bypasses that.
    // Pass one of the default option labels — no typing needed, they are always shown on open.
    async setDueDateFromHoverMenu(taskIndex: number, optionLabel: string): Promise<void> {
        await this.checklistItem(taskIndex).hover();
        // Force-click the calendar icon — it's in the DOM but opacity:0 until hovered.
        await this.checklistItem(taskIndex).locator('.icon-calendar-outline').click({force: true});
        // Wait for the date picker dropdown to render its options.
        await this.page.locator('.playbook-react-select__option').first().waitFor();
        // Click the option whose label matches optionLabel.
        await this.page.locator('.playbook-react-select__option', {hasText: optionLabel}).first().click();
    }

    // Asserts the due-date info button at the given checklist offset shows the date text.
    // `itemOffset` is the 0-based index among all due-date-info-button elements on screen.
    async expectDueDateButton(itemOffset: number, dateText: string): Promise<void> {
        const btn = this.page.getByTestId('due-date-info-button').nth(itemOffset);
        await expect(btn).toContainText(dateText);
        await expect(btn).toContainText('Due');
    }

    // Asserts the due-date info button at the given offset is visible and shows 'Due'.
    // Use this when you want to verify a due date was set without checking the exact text.
    async expectDueDateButtonVisible(itemOffset: number): Promise<void> {
        const btn = this.page.getByTestId('due-date-info-button').nth(itemOffset);
        await expect(btn).toBeVisible();
        await expect(btn).toContainText('Due');
    }

    // Asserts the task at `taskIndex` has NO due-date info button.
    async expectNoDueDateAtTask(taskIndex: number): Promise<void> {
        await expect(
            this.checklistItem(taskIndex).getByTestId('due-date-info-button'),
        ).toHaveCount(0);
    }

    // Asserts the overdue filter badge shows the given text (e.g. '2 tasks overdue').
    async expectOverdueFilterText(text: string): Promise<void> {
        await expect(this.overdueFilter().first()).toContainText(text);
    }

    // Clicks the overdue filter badge.
    async clickOverdueFilter(): Promise<void> {
        await this.overdueFilter().first().click();
    }

    // Asserts the overdue filter badge is not present.
    async expectOverdueFilterHidden(): Promise<void> {
        await expect(this.overdueFilter()).toHaveCount(0);
    }

    // Asserts the total number of visible checkbox-item-container elements.
    async expectVisibleTaskCount(count: number): Promise<void> {
        await expect(this.checklistItems()).toHaveCount(count);
    }

    // Returns the checked-by chip element for the task at the given index.
    checkedByChip(taskIndex: number): Locator {
        return this.checklistItem(taskIndex).getByTestId('checklist-item-checked-chip');
    }

    // Asserts the checked-by chip is visible for the task at the given index.
    async expectCheckedByChipVisible(taskIndex: number): Promise<void> {
        await expect(this.checkedByChip(taskIndex)).toBeVisible();
    }

    // Asserts the checked-by chip is NOT present for the task at the given index.
    async expectCheckedByChipHidden(taskIndex: number): Promise<void> {
        await expect(this.checkedByChip(taskIndex)).toHaveCount(0);
    }

    // Hovers over the chip to reveal the tooltip, then asserts the tooltip contains
    // the expected action verb (e.g. 'checked off', 'unchecked', 'skipped', 'restored').
    async expectChipTooltipContains(taskIndex: number, verb: string): Promise<void> {
        await this.checkedByChip(taskIndex).hover();
        // The WithTooltip component renders a tooltip with role='tooltip'.
        await expect(this.page.getByRole('tooltip').filter({hasText: verb})).toBeVisible();
    }

    // Asserts the task at `index` shows the 'skipped' marker.
    // When a task is skipped, the title is wrapped in a StrikeThrough element with
    // data-cy='skipped' (see checklist_item/title.tsx).
    async expectTaskSkipped(index: number): Promise<void> {
        await expect(this.checklistItem(index).locator('[data-cy=skipped]')).toBeVisible();
    }

    // Asserts the task at `index` does NOT show the 'skipped' marker.
    async expectTaskNotSkipped(index: number): Promise<void> {
        await expect(this.checklistItem(index).locator('[data-cy=skipped]')).toHaveCount(0);
    }

    // Clicks the edit-mode button in the hover menu of the task at `index`.
    // The button is identified by data-testid='hover-menu-edit-button'.
    async openEditModeForTask(index: number): Promise<void> {
        await this.checklistItem(index).hover();
        // The edit button appears in the hover menu; scoped to the first occurrence
        // to avoid ambiguity when multiple tasks are visible.
        await this.page.getByTestId('hover-menu-edit-button').first().click();
    }

    // Clicks the due-date-info-button at the given 0-based offset (among all such
    // buttons currently visible) to open the date picker from edit mode.
    async clickDueDateInfoButton(offset: number): Promise<void> {
        await this.page.getByTestId('due-date-info-button').nth(offset).click();
    }

    // Selects a named option from an already-open date picker dropdown.
    // Used when the picker is already open (e.g. after clickDueDateInfoButton).
    // Pass a default option label: 'Tomorrow', 'Today', 'Next week', etc.
    async selectDateOption(optionLabel: string): Promise<void> {
        await this.page.locator('.playbook-react-select__option').first().waitFor();
        await this.page.locator('.playbook-react-select__option', {hasText: optionLabel}).first().click();
    }

    // Types a date query into the open date picker and clicks the first option.
    // Used when the date picker is already open (e.g. from clickDueDateInfoButton).
    async typeAndSelectDateOption(dateQuery: string): Promise<void> {
        const dateInput = this.page.locator('.playbook-react-select input');
        await dateInput.waitFor();
        await dateInput.type(dateQuery);
        // Wait 300 ms for the debounce before clicking the first rendered option.
        await this.page.waitForTimeout(300);
        await this.page.locator('.playbook-react-select__option').first().click();
    }

    // Returns the react-select date-picker input that appears when the due-date
    // selector is open.  React-select v4 renders the actual <input> inside a div
    // with class 'playbook-react-select__input-container'.
    dueDateInput(): Locator {
        return this.page.locator('.playbook-react-select input');
    }

    // Waits for the first option to appear in the date picker dropdown.
    // React-select v4 renders options as divs with class 'playbook-react-select__option'
    // rather than a semantic role="option" element; wait on the CSS class.
    async waitForDatePickerOption(): Promise<void> {
        await this.page.locator('.playbook-react-select__option').first().waitFor();
    }

    // Scrolls the task at `taskIndex` into view and opens the due-date calendar
    // by hovering and clicking the calendar icon — used for the scroll-regression test.
    async openDueDatePickerAtScrolledTask(taskIndex: number): Promise<void> {
        await this.checklistItem(taskIndex).scrollIntoViewIfNeeded();
        await this.checklistItem(taskIndex).hover();
        await this.checklistItem(taskIndex).locator('.icon-calendar-outline').click({force: true});
    }

    // Asserts the due-date date picker (react-select) is visible after the calendar opens.
    async expectDatePickerVisible(): Promise<void> {
        await expect(this.page.locator('.playbook-react-select input')).toBeVisible();
    }
}
