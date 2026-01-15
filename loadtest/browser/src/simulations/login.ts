// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {createTestFailure, type SimulationLogger} from '../types.js';
import {getLogger} from '../utils/logger.js';

/**
 * Handles the "View in Browser" preference checkbox on the landing page.
 * This appears when users first navigate to the Mattermost server.
 */
export async function handlePreferenceCheckbox(page: Page, logger?: SimulationLogger): Promise<void> {
  const log = getLogger(logger);
  log.info('run--handlePreferenceCheckbox');

  try {
    const isLandingPage = await page
      .waitForURL((url) => url.pathname.includes('/landing'), {timeout: 5000})
      .then(() => true)
      .catch(() => false);

    if (!isLandingPage) {
      log.info('skip--handlePreferenceCheckbox--not-on-landing-page');
      return;
    }

    // Click "View in Browser" button
    const viewInBrowserButton = page.locator('text=View in Browser');
    await viewInBrowserButton.waitFor({state: 'visible'});
    await viewInBrowserButton.click();

    log.info('pass--handlePreferenceCheckbox');
  } catch (error) {
    // If button not found, log and skip
    log.info('skip--handlePreferenceCheckbox');
  }
}

/**
 * Performs the login flow with the given credentials.
 */
export async function performLogin({
  page,
  userId,
  password,
  logger,
}: {
  page: Page;
  userId: string;
  password: string;
  logger?: SimulationLogger;
}): Promise<void> {
  const log = getLogger(logger);
  log.info('run--performLogin');

  try {
    // Fill in the login ID (email or username)
    const loginInput = page.locator('#input_loginId');
    await loginInput.waitFor({state: 'visible'});
    await loginInput.fill(userId);

    // Fill in the password
    const passwordInput = page.locator('#input_password-input');
    await passwordInput.waitFor({state: 'visible'});
    await passwordInput.fill(password);

    // Click the sign in button
    const signInButton = page.locator('button:has-text("Log in")');
    await signInButton.waitFor({state: 'visible'});
    await Promise.all([page.waitForNavigation(), signInButton.click()]);

    log.info('pass--performLogin');
  } catch (error) {
    throw createTestFailure('performLogin', error);
  }
}

/**
 * Handles team selection if the user is redirected to the team selection page.
 */
export async function handleTeamSelection(page: Page, logger?: SimulationLogger): Promise<void> {
  const log = getLogger(logger);
  log.info('run--handleTeamSelection');

  try {
    const isTeamSelectionPage = await page
      .waitForURL((url) => url.pathname.includes('/select_team'), {timeout: 5000})
      .then(() => true)
      .catch(() => false);

    if (!isTeamSelectionPage) {
      log.info('skip--handleTeamSelection--not-on-team-selection-page');
      return;
    }

    await page.waitForSelector('.signup-team-dir a');
    const teamElement = page.locator('.signup-team-dir a').first();
    await teamElement.click();

    await page.waitForURL((url) => !url.pathname.includes('/select_team'));

    log.info('pass--handleTeamSelection');
  } catch (error) {
    log.info('skip--handleTeamSelection');
  }
}
