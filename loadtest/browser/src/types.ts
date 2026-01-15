// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

/**
 * Logger interface for simulations.
 * This allows the consuming application (mattermost-load-test-ng) to inject its own logger.
 */
export interface SimulationLogger {
  info: (message: string) => void;
  error: (message: string) => void;
  warn?: (message: string) => void;
  debug?: (message: string) => void;
}

/**
 * Browser instance containing page and credentials for running simulations.
 */
export interface PlaybooksBrowserInstance {
  page: Page;
  userId: string;
  password: string;
}

/**
 * Base type for simulation scenarios.
 * Each scenario receives a browser instance, server URL, and optional logger.
 */
export type PlaybooksSimulationScenario = (
  browserInstance: PlaybooksBrowserInstance,
  serverURL: string,
  logger?: SimulationLogger,
) => Promise<void>;

/**
 * Unique identifiers for playbooks simulations.
 */
export enum PlaybooksSimulationIds {
  createAndRunPlaybook = 'createAndRunPlaybook',
  browsePlaybooks = 'browsePlaybooks',
  viewPlaybookRun = 'viewPlaybookRun',
}

/**
 * Registry item for a simulation scenario.
 */
export interface PlaybooksSimulationRegistryItem {
  id: PlaybooksSimulationIds;
  name: string;
  description: string;
  scenario: PlaybooksSimulationScenario;
}

/**
 * Test failure error structure for consistent error handling.
 */
export interface TestFailureError {
  error: Error;
  testId: string;
}

/**
 * Helper to create a test failure error.
 */
export function createTestFailure(testId: string, error: unknown): TestFailureError {
  return {
    error: error instanceof Error ? error : new Error(String(error)),
    testId,
  };
}

/**
 * Type guard to check if an error is a TestFailureError.
 */
export function isTestFailureError(error: unknown): error is TestFailureError {
  return typeof error === 'object' && error !== null && 'error' in error && 'testId' in error;
}
