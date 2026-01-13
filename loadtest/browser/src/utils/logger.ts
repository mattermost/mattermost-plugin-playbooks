// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SimulationLogger} from '../types.js';

/**
 * Default no-op logger when no logger is provided.
 */
const noopLogger: SimulationLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
};

/**
 * Gets the logger instance or returns a no-op logger if none is provided.
 */
export function getLogger(logger?: SimulationLogger): SimulationLogger {
  return logger ?? noopLogger;
}

/**
 * Wraps a simulation step with logging.
 * Logs the start and completion/failure of the step.
 */
export async function withLogging<T>(
  stepName: string,
  fn: () => Promise<T>,
  logger?: SimulationLogger,
): Promise<T> {
  const log = getLogger(logger);
  log.info(`run--${stepName}`);

  try {
    const result = await fn();
    log.info(`pass--${stepName}`);
    return result;
  } catch (error) {
    log.error(`fail--${stepName}--${error}`);
    throw error;
  }
}
