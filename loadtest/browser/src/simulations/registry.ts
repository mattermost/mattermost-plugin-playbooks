// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
  PlaybooksSimulationIds,
  type PlaybooksSimulationRegistryItem,
} from '../types.js';
import {createAndRunPlaybookScenario} from './create_and_run_playbook_scenario.js';
import {browsePlaybooksScenario} from './browse_playbooks_scenario.js';
import {viewPlaybookRunScenario} from './view_playbook_run_scenario.js';

/**
 * Registry of all available playbooks simulations.
 * Each simulation can be retrieved by its ID and executed.
 */
export const PlaybooksSimulationsRegistry: PlaybooksSimulationRegistryItem[] = [
  {
    id: PlaybooksSimulationIds.createAndRunPlaybook,
    name: 'Create and Run Playbook',
    description: 'Creates a new playbook, starts a run, completes checklist items, and posts status updates',
    scenario: createAndRunPlaybookScenario,
  },
  {
    id: PlaybooksSimulationIds.browsePlaybooks,
    name: 'Browse Playbooks',
    description: 'Browses through playbooks and runs lists, generating read-heavy traffic',
    scenario: browsePlaybooksScenario,
  },
  {
    id: PlaybooksSimulationIds.viewPlaybookRun,
    name: 'View Playbook Run',
    description: 'Views and scrolls through playbook run details',
    scenario: viewPlaybookRunScenario,
  },
];

/**
 * Gets a simulation by its ID.
 * @throws Error if the simulation ID is not found.
 */
export function getPlaybooksSimulation(
  simulationId: PlaybooksSimulationIds,
): PlaybooksSimulationRegistryItem {
  const simulation = PlaybooksSimulationsRegistry.find((s) => s.id === simulationId);
  if (!simulation) {
    throw new Error(`Playbooks simulation '${simulationId}' not found in registry`);
  }
  return simulation;
}

/**
 * Gets all available playbooks simulation IDs.
 */
export function getPlaybooksSimulationIds(): PlaybooksSimulationIds[] {
  return PlaybooksSimulationsRegistry.map((s) => s.id);
}
