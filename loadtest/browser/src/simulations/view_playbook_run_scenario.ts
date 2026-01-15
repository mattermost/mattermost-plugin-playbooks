// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type PlaybooksBrowserInstance, type SimulationLogger} from '../types.js';
import {handlePreferenceCheckbox, performLogin, handleTeamSelection} from './login.js';
import {goToPlaybooks, goToPlaybookRuns} from './navigation.js';
import {viewPlaybookRunDetails, scrollPlaybooksList} from './playbook_actions.js';

/**
 * A scenario that simulates a user viewing and interacting with playbook runs.
 * This focuses on viewing existing run data and scrolling through details.
 */
export async function viewPlaybookRunScenario(
  {page, userId, password}: PlaybooksBrowserInstance,
  serverURL: string,
  logger?: SimulationLogger,
  runInLoop = true,
): Promise<void> {
  if (!page) {
    throw new Error('Page is not initialized');
  }

  await page.goto(serverURL);

  await handlePreferenceCheckbox(page, logger);

  await performLogin({page, userId, password, logger});

  await handleTeamSelection(page, logger);

  // Navigate to Playbooks
  await goToPlaybooks(page, logger);

  // Simulation parameters
  const scrollCount = runInLoop ? 15 : 3;
  const scrollStep = 200;
  const pauseBetweenScrolls = 600;

  // Runs the simulation at least once and then runs it in a continuous loop if runInLoop is true
  do {
    // Go to runs list
    await goToPlaybookRuns(page, logger);

    // Scroll through the runs list
    await scrollPlaybooksList(page, scrollCount, scrollStep, pauseBetweenScrolls, logger);

    // View details of a run (if available)
    try {
      await viewPlaybookRunDetails(page, logger);

      // Scroll through the run details
      await scrollPlaybooksList(page, scrollCount, scrollStep, pauseBetweenScrolls, logger);
    } catch {
      // If no runs are available, just continue browsing
      logger?.info?.('skip--viewPlaybookRunDetails--no-runs-available');
    }

    // Go back to runs list
    await goToPlaybookRuns(page, logger);

    // Add a delay between iterations
    if (runInLoop) {
      await page.waitForTimeout(2000);
    }
  } while (runInLoop);
}
