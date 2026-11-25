// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

// The phase timeline shown above the summary of a run that has phases.
export class PhaseTimeline {
    readonly page: Page;
    readonly root: Locator;
    readonly steps: Locator;
    readonly currentChip: Locator;
    readonly detail: Locator;
    readonly nextButton: Locator;
    readonly nextMenuButton: Locator;
    readonly keepOpenItem: Locator;
    readonly finishButton: Locator;
    readonly markers: Locator;
    readonly markerAction: Locator;
    readonly confirmModal: Locator;
    readonly confirmButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByTestId('phase-timeline');
        this.steps = this.root.getByRole('listitem');
        this.currentChip = page.getByTestId('phase-timeline-current');
        this.detail = page.getByTestId('phase-timeline-detail');
        this.nextButton = page.getByTestId('phase-timeline-next');
        this.nextMenuButton = page.getByTestId('phase-timeline-next-menu');
        this.keepOpenItem = page.getByTestId('phase-timeline-keep-open');
        this.finishButton = page.getByTestId('phase-timeline-finish');
        this.markers = page.getByTestId('phase-marker');
        this.markerAction = page.getByTestId('phase-marker-action');
        this.confirmModal = page.getByRole('dialog', {name: 'Set the current phase manually?'});
        this.confirmButton = this.confirmModal.getByRole('button', {name: 'Set current phase'});
    }

    // The accessible label of every step, in order, such as "Triage: Done".
    async labels(): Promise<Array<string | null>> {
        return this.steps.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
    }

    step(title: string): Locator {
        return this.steps.filter({hasText: title});
    }

    async moveToNext() {
        await this.nextButton.click();
    }

    // The circle of a phase, which is a button for a phase that started.
    marker(title: string): Locator {
        return this.page.getByRole('button', {name: `Options for phase ${title}`, exact: true});
    }

    // Moves to the next phase, leaving the current one open, through the menu next to the move button.
    async moveToNextKeepingCurrentOpen() {
        await this.nextMenuButton.click();
        await this.keepOpenItem.click();
    }

    async finishLastPhase() {
        await this.finishButton.click();
    }

    async openMarkerMenu(title: string) {
        await this.marker(title).click();
    }

    // Picks the one action of an open circle menu ("Mark as done" or "Reopen").
    async chooseMarkerAction() {
        await this.markerAction.click();
    }

    async confirmManualPhase() {
        await this.confirmButton.click();
    }
}
