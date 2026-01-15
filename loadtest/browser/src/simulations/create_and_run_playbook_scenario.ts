// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type PlaybooksBrowserInstance, type SimulationLogger} from '../types.js';
import {handlePreferenceCheckbox, performLogin, handleTeamSelection} from './login.js';
import {goToPlaybooks, goToPlaybooksList} from './navigation.js';
import {createPlaybook, startPlaybookRun, completeChecklistItem, postStatusUpdate} from './playbook_actions.js';

/**
 * A complete scenario that creates a new playbook, starts a run, and interacts with it.
 * This simulates a user workflow of setting up and using playbooks.
 */
export async function createAndRunPlaybookScenario(
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
  await goToPlaybooksList(page, logger);

  const timestamp = Date.now();
  let iteration = 0;

  // Runs the simulation at least once and then runs it in a continuous loop if runInLoop is true
  do {
    const playbookName = `Load Test Playbook ${timestamp}-${iteration}`;
    const runName = `Load Test Run ${timestamp}-${iteration}`;
    const updateMessage = `Status update from load test at ${new Date().toISOString()}`;

    // Create a new playbook
    await createPlaybook(page, playbookName, logger);

    // Start a run of the playbook
    await startPlaybookRun(page, runName, logger);

    // Interact with the run - complete checklist items
    await completeChecklistItem(page, 0, logger);
    await completeChecklistItem(page, 1, logger);

    // Post a status update
    await postStatusUpdate(page, updateMessage, logger);

    // Navigate back to playbooks list for next iteration
    await goToPlaybooksList(page, logger);

    iteration++;

    // Add a small delay between iterations
    if (runInLoop) {
      await page.waitForTimeout(2000);
    }
  } while (runInLoop);
}
