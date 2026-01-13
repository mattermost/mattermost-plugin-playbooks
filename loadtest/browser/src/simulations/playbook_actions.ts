// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {createTestFailure, type SimulationLogger} from '../types.js';
import {getLogger} from '../utils/logger.js';

/**
 * Creates a new playbook with default settings.
 */
export async function createPlaybook(
  page: Page,
  playbookName: string,
  logger?: SimulationLogger,
): Promise<void> {
  const log = getLogger(logger);
  log.info(`run--createPlaybook--${playbookName}`);

  try {
    // Click the Create playbook button
    const createButton = page.getByRole('button', {name: /create/i}).or(page.locator('[data-testid="create-playbook"]'));
    await createButton.first().waitFor({state: 'visible'});
    await createButton.first().click();

    // Wait for the playbook creation form/modal
    const nameInput = page
      .getByPlaceholder(/playbook name/i)
      .or(page.locator('input[name="name"]'))
      .or(page.getByTestId('playbook-name-input'));
    await nameInput.waitFor({state: 'visible'});
    await nameInput.fill(playbookName);

    // Save/Create the playbook
    const saveButton = page
      .getByRole('button', {name: /save|create/i})
      .or(page.locator('[data-testid="save-playbook"]'));
    await saveButton.first().waitFor({state: 'visible'});
    await saveButton.first().click();

    // Wait for playbook to be created (URL should change or success indicator)
    await page.waitForTimeout(1000);

    log.info(`pass--createPlaybook--${playbookName}`);
  } catch (error) {
    throw createTestFailure('createPlaybook', error);
  }
}

/**
 * Starts a new run of an existing playbook.
 */
export async function startPlaybookRun(
  page: Page,
  runName: string,
  logger?: SimulationLogger,
): Promise<void> {
  const log = getLogger(logger);
  log.info(`run--startPlaybookRun--${runName}`);

  try {
    // Click Run button (usually available in playbook detail view)
    const runButton = page
      .getByRole('button', {name: /run|start/i})
      .or(page.locator('[data-testid="run-playbook"]'));
    await runButton.first().waitFor({state: 'visible'});
    await runButton.first().click();

    // Fill in the run name if a modal appears
    const runNameInput = page
      .getByPlaceholder(/run name/i)
      .or(page.locator('input[name="runName"]'))
      .or(page.getByTestId('run-name-input'));

    const isRunNameInputVisible = await runNameInput.isVisible().catch(() => false);
    if (isRunNameInputVisible) {
      await runNameInput.fill(runName);
    }

    // Confirm/Start the run
    const confirmButton = page.getByRole('button', {name: /start|confirm|ok/i});
    await confirmButton.first().waitFor({state: 'visible'});
    await confirmButton.first().click();

    // Wait for run to start
    await page.waitForTimeout(1000);

    log.info(`pass--startPlaybookRun--${runName}`);
  } catch (error) {
    throw createTestFailure('startPlaybookRun', error);
  }
}

/**
 * Views the details of a specific playbook run.
 */
export async function viewPlaybookRunDetails(page: Page, logger?: SimulationLogger): Promise<void> {
  const log = getLogger(logger);
  log.info('run--viewPlaybookRunDetails');

  try {
    // Click on the first available run in the list
    const runRow = page.locator('[data-testid="run-row"]').or(page.locator('.playbook-run-item')).or(page.locator('tr'));
    await runRow.first().waitFor({state: 'visible'});
    await runRow.first().click();

    // Wait for the run details page to load
    await page.waitForURL((url) => url.pathname.includes('/runs/'));

    log.info('pass--viewPlaybookRunDetails');
  } catch (error) {
    throw createTestFailure('viewPlaybookRunDetails', error);
  }
}

/**
 * Scrolls through the playbooks list to simulate browsing behavior.
 */
export async function scrollPlaybooksList(
  page: Page,
  scrollCount: number,
  scrollStep: number,
  pauseBetweenScrolls: number,
  logger?: SimulationLogger,
): Promise<void> {
  const log = getLogger(logger);
  log.info('run--scrollPlaybooksList');

  try {
    const scrollContainer = page
      .locator('.playbooks-list')
      .or(page.locator('[data-testid="playbooks-list"]'))
      .or(page.locator('main'));

    await scrollContainer.waitFor({state: 'visible'});

    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(
        (params) => {
          const container = document.querySelector(params.selector) as HTMLElement;
          if (container) {
            container.scrollBy({top: params.step, behavior: 'smooth'});
          }
        },
        {selector: 'main', step: scrollStep},
      );

      await page.waitForTimeout(pauseBetweenScrolls);
    }

    log.info('pass--scrollPlaybooksList');
  } catch (error) {
    throw createTestFailure('scrollPlaybooksList', error);
  }
}

/**
 * Completes a checklist item in a playbook run.
 */
export async function completeChecklistItem(page: Page, itemIndex: number, logger?: SimulationLogger): Promise<void> {
  const log = getLogger(logger);
  log.info(`run--completeChecklistItem--${itemIndex}`);

  try {
    const checklistItems = page
      .locator('[data-testid="checklist-item"]')
      .or(page.locator('.checklist-item'))
      .or(page.locator('.playbook-run-checklist-item'));

    const item = checklistItems.nth(itemIndex);
    await item.waitFor({state: 'visible'});

    const checkbox = item.locator('input[type="checkbox"]').or(item.locator('[role="checkbox"]'));
    await checkbox.click();

    await page.waitForTimeout(500);

    log.info(`pass--completeChecklistItem--${itemIndex}`);
  } catch (error) {
    throw createTestFailure('completeChecklistItem', error);
  }
}

/**
 * Posts an update in a playbook run.
 */
export async function postStatusUpdate(page: Page, message: string, logger?: SimulationLogger): Promise<void> {
  const log = getLogger(logger);
  log.info('run--postStatusUpdate');

  try {
    // Click the post update button
    const updateButton = page
      .getByRole('button', {name: /post update|status update/i})
      .or(page.locator('[data-testid="post-update-button"]'));
    await updateButton.first().waitFor({state: 'visible'});
    await updateButton.first().click();

    // Fill in the update message
    const messageInput = page
      .locator('textarea')
      .or(page.getByPlaceholder(/message|update/i))
      .or(page.getByTestId('update-message-input'));
    await messageInput.first().waitFor({state: 'visible'});
    await messageInput.first().fill(message);

    // Submit the update
    const submitButton = page.getByRole('button', {name: /post|submit|send/i});
    await submitButton.first().waitFor({state: 'visible'});
    await submitButton.first().click();

    await page.waitForTimeout(1000);

    log.info('pass--postStatusUpdate');
  } catch (error) {
    throw createTestFailure('postStatusUpdate', error);
  }
}
