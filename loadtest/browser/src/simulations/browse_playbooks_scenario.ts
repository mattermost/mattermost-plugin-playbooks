// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type PlaybooksBrowserInstance, type SimulationLogger} from '../types.js';
import {handlePreferenceCheckbox, performLogin, handleTeamSelection} from './login.js';
import {goToPlaybooks, goToPlaybooksList, goToPlaybookRuns} from './navigation.js';
import {scrollPlaybooksList} from './playbook_actions.js';

/**
 * A scenario that simulates a user browsing through playbooks and runs.
 * This generates read-heavy traffic without creating new data.
 */
export async function browsePlaybooksScenario(
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
  const scrollCount = runInLoop ? 20 : 5;
  const scrollStep = 300;
  const pauseBetweenScrolls = 500;

  // Runs the simulation at least once and then runs it in a continuous loop if runInLoop is true
  do {
    // Browse the playbooks list
    await goToPlaybooksList(page, logger);
    await scrollPlaybooksList(page, scrollCount, scrollStep, pauseBetweenScrolls, logger);

    // Browse the runs list
    await goToPlaybookRuns(page, logger);
    await scrollPlaybooksList(page, scrollCount, scrollStep, pauseBetweenScrolls, logger);

    // Add a delay between iterations
    if (runInLoop) {
      await page.waitForTimeout(3000);
    }
  } while (runInLoop);
}
