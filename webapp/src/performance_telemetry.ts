// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Mark names for playbooks performance telemetry.
 * Marks are used to record a point in time (e.g., when a user clicks a link).
 */
export const enum Mark {
    PlaybooksLHSLinkClicked = 'PlaybooksLHS#playbooksLinkClicked',
    RunsLHSLinkClicked = 'PlaybooksLHS#runsLinkClicked',
}

/**
 * Measure names for playbooks performance telemetry.
 * Measures record durations between two marks or from a mark to now.
 */
export const enum Measure {
    PlaybooksListLoad = 'playbooks_list_load',
    RunsListLoad = 'playbooks_runs_list_load',
}

/**
 * Creates a performance mark that will be reported to the server.
 * The mark will be caught by Mattermost's webapp PerformanceObserver.
 *
 * This is exact copy of function defined in mattermost/webapp/src/performance_telemetry.ts
 */
export function mark(name: string): PerformanceMark {
    return performance.mark(name, {
        detail: {
            report: true,
        },
    });
}

/**
 * Measures the duration between two performance marks, further it will be reported to the server
 * by Mattermost's webapp PerformanceObserver.
 *
 * If endMark is omitted, the measure will measure the duration until now.
 * If the start mark does not exist and canFail is false, an error will be logged.
 *
 * This is exact copy of function defined in mattermost/webapp/src/performance_telemetry.ts
 */
export function measureAndReport({
    name,
    startMark,
    endMark,
    canFail = false,
}: {
    name: string;
    startMark: string;
    endMark?: string;
    canFail?: boolean;
}): PerformanceMeasure | undefined {
    const options: PerformanceMeasureOptions = {
        start: startMark,
        end: endMark,
        detail: {
            report: true,
        },
    };

    try {
        return performance.measure(name, options);
    } catch (e) {
        if (!canFail) {
            // eslint-disable-next-line no-console
            console.error('Unable to measure ' + name, e);
        }

        return undefined;
    }
}
