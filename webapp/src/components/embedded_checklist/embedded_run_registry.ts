// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {playbookRunUpdated} from 'src/actions';
import {fetchPlaybookRun} from 'src/client';
import {Dispatch} from 'src/types/store';

const mountedRuns = new Map<string, number>();
const suppressedChannels = new Map<string, number>();

function retain(refs: Map<string, number>, key: string): () => void {
    refs.set(key, (refs.get(key) ?? 0) + 1);

    let released = false;
    return () => {
        if (released) {
            return;
        }
        released = true;

        const count = (refs.get(key) ?? 0) - 1;
        if (count > 0) {
            refs.set(key, count);
        } else {
            refs.delete(key);
        }
    };
}

export const registerEmbeddedRun = (runId: string) => retain(mountedRuns, runId);

/** Keeps the Playbooks RHS from auto-opening in the channel until the returned function is called. */
export const suppressAutoOpen = (channelId: string) => retain(suppressedChannels, channelId);

export const isChannelEmbedded = (channelId: string) => suppressedChannels.has(channelId);

/** Refetches every mounted embedded run, including runs the viewer does not participate in. */
export async function refetchEmbeddedRuns(dispatch: Dispatch): Promise<void> {
    await Promise.all([...mountedRuns.keys()].map(async (runId) => {
        try {
            dispatch(playbookRunUpdated(await fetchPlaybookRun(runId)));
        } catch {
            // The embed keeps showing its cached run.
        }
    }));
}

export function resetEmbeddedRegistry() {
    mountedRuns.clear();
    suppressedChannels.clear();
}
