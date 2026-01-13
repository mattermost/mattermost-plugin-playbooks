// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {createTestFailure, type SimulationLogger} from '../types.js';
import {getLogger} from '../utils/logger.js';

/**
 * Navigates to a specific channel by sidebar item ID.
 */
export async function goToChannel(page: Page, channelId: string, logger?: SimulationLogger): Promise<void> {
  const log = getLogger(logger);
  log.info(`run--goToChannel--${channelId}`);

  try {
    // Click on the channel in the sidebar
    const channel = page.locator(`#sidebarItem_${channelId}`);
    await channel.waitFor({state: 'visible'});
    await channel.click();

    // Wait until the loading screen is gone and the channel is loaded
    await page.locator('#virtualizedPostListContent').waitFor({state: 'visible'});

    log.info(`pass--goToChannel--${channelId}`);
  } catch (error) {
    throw createTestFailure('goToChannel', error);
  }
}

/**
 * Navigates to the Playbooks section using the product switch menu.
 */
export async function goToPlaybooks(page: Page, logger?: SimulationLogger): Promise<void> {
  const log = getLogger(logger);
  log.info('run--goToPlaybooks');

  try {
    // Click on the product switcher menu button in the global header
    const productSwitchButton = page
      .getByRole('button', {name: 'Product switch menu'})
      .or(page.getByRole('button', {name: 'Switch product menu'}))
      .or(page.locator('[aria-label="Product switch menu"]'));
    await productSwitchButton.waitFor({state: 'visible'});
    await productSwitchButton.click();

    // Click on Playbooks in the dropdown menu
    const playbooksLink = page.getByRole('link', {name: 'Playbooks'});
    await playbooksLink.waitFor({state: 'visible'});
    await playbooksLink.click();

    // Wait for the playbooks page to load
    await page.waitForURL((url) => url.pathname.includes('/playbooks'));

    log.info('pass--goToPlaybooks');
  } catch (error) {
    throw createTestFailure('goToPlaybooks', error);
  }
}

/**
 * Navigates to the Playbook Runs list.
 */
export async function goToPlaybookRuns(page: Page, logger?: SimulationLogger): Promise<void> {
  const log = getLogger(logger);
  log.info('run--goToPlaybookRuns');

  try {
    // Click on Runs in the sidebar or navigation
    const runsLink = page.locator('a[href*="/runs"]').or(page.getByRole('link', {name: 'Runs'}));
    await runsLink.first().waitFor({state: 'visible'});
    await runsLink.first().click();

    // Wait for the runs page to load
    await page.waitForURL((url) => url.pathname.includes('/runs'));

    log.info('pass--goToPlaybookRuns');
  } catch (error) {
    throw createTestFailure('goToPlaybookRuns', error);
  }
}

/**
 * Navigates to the Playbooks list page.
 */
export async function goToPlaybooksList(page: Page, logger?: SimulationLogger): Promise<void> {
  const log = getLogger(logger);
  log.info('run--goToPlaybooksList');

  try {
    // Navigate to the playbooks list
    const playbooksLink = page
      .locator('a[href*="/playbooks"]:not([href*="/runs"])')
      .or(page.getByRole('link', {name: 'Playbooks', exact: true}));
    await playbooksLink.first().waitFor({state: 'visible'});
    await playbooksLink.first().click();

    // Wait for the playbooks list to load
    await page.waitForURL((url) => url.pathname.includes('/playbooks') && !url.pathname.includes('/runs'));

    log.info('pass--goToPlaybooksList');
  } catch (error) {
    throw createTestFailure('goToPlaybooksList', error);
  }
}
