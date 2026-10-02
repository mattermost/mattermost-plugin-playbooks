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

    constructor(page: Page) {
        this.page = page;
        this.mm = new MattermostCore(page);
        this.title = page.getByTestId('rhs-title');
        this.runTitle = page.getByTestId('menuButton');
        this.contextMenu = page.getByTestId('dropdownmenu');
        this.checklist = page.getByTestId('pb-checklists-inner-container');
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
}
