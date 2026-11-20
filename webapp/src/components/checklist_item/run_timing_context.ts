// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createContext, useContext} from 'react';

import {ChecklistItemTiming, RunTiming} from 'src/types/run_timing';

export interface RunTimingContextValue {
    timing: RunTiming;
    itemsByID: Map<string, ChecklistItemTiming>;
    runEnded: boolean;
}

export const RunTimingContext = createContext<RunTimingContextValue | null>(null);

export const useRunTimingContext = () => useContext(RunTimingContext);

export const indexRunTiming = (timing: RunTiming, runEnded: boolean): RunTimingContextValue => ({
    timing,
    itemsByID: new Map(timing.items.map((item) => [item.item_id, item])),
    runEnded,
});

// Server figures are as of computed_at; anything still running keeps growing until the next fetch.
export const liveMillis = (millis: number, stillRunning: boolean, computedAt: number, now: number) => (
    stillRunning ? millis + Math.max(0, now - computedAt) : millis
);
