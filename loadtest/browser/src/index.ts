// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Playbooks Load Test Simulations
 *
 * This module exports all playbooks-specific simulations that can be imported
 * and run by the mattermost-load-test-ng browser testing framework.
 *
 * Usage in mattermost-load-test-ng:
 * ```typescript
 * import {
 *   PlaybooksSimulationsRegistry,
 *   PlaybooksSimulationIds,
 *   getPlaybooksSimulation,
 * } from 'playbooks-load-simulations';
 * ```
 */

// Export all types
export {
  type SimulationLogger,
  type PlaybooksBrowserInstance,
  type PlaybooksSimulationScenario,
  type PlaybooksSimulationRegistryItem,
  type TestFailureError,
  PlaybooksSimulationIds,
  createTestFailure,
  isTestFailureError,
} from './types.js';

// Export the registry and helper functions
export {
  PlaybooksSimulationsRegistry,
  getPlaybooksSimulation,
  getPlaybooksSimulationIds,
} from './simulations/registry.js';

// Export individual scenarios for direct import if needed
export {createAndRunPlaybookScenario} from './simulations/create_and_run_playbook_scenario.js';
export {browsePlaybooksScenario} from './simulations/browse_playbooks_scenario.js';
export {viewPlaybookRunScenario} from './simulations/view_playbook_run_scenario.js';

// Export individual simulation building blocks for composition
export {handlePreferenceCheckbox, performLogin, handleTeamSelection} from './simulations/login.js';
export {goToChannel, goToPlaybooks, goToPlaybookRuns, goToPlaybooksList} from './simulations/navigation.js';
export {
  createPlaybook,
  startPlaybookRun,
  viewPlaybookRunDetails,
  scrollPlaybooksList,
  completeChecklistItem,
  postStatusUpdate,
} from './simulations/playbook_actions.js';

// Export utility functions
export {getLogger, withLogging} from './utils/logger.js';
