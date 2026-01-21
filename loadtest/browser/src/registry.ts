// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type SimulationRegistryItem} from "@mattermost/loadtest-browser-lib";

import {createAndRunPlaybookScenario} from "./simulations/create_and_run_playbook_scenario.js";

/**
 * Registry of all available playbooks simulations.
 * Each simulation can be retrieved by its ID and executed.
 */
export const SimulationsRegistry: SimulationRegistryItem[] = [
  {
    id: "playbooksCreateAndRun",
    name: "Playbooks's create and run multiple playbooks scenario",
    description:
      "A scenario that creates a new playbook, starts a run, and browses through the playbook runs",
    scenario: createAndRunPlaybookScenario,
  },
];
