// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

// The phase timeline shown above the summary of a run that uses its task lists as phases.
export class PhaseTimeline {
    readonly page: Page;
    readonly root: Locator;
    readonly steps: Locator;
    readonly currentChip: Locator;
    readonly detail: Locator;
    readonly nextButton: Locator;
    readonly confirmModal: Locator;
    readonly confirmButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByTestId('phase-timeline');
        this.steps = this.root.getByRole('listitem');
        this.currentChip = page.getByTestId('phase-timeline-current');
        this.detail = page.getByTestId('phase-timeline-detail');
        this.nextButton = page.getByTestId('phase-timeline-next');
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

    async confirmManualPhase() {
        await this.confirmButton.click();
    }
}
