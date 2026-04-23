// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {GetStateFunc} from 'mattermost-redux/types/actions';
import {Post} from '@mattermost/types/posts';
import {WebSocketMessage} from '@mattermost/client';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {PlaybookRun, StatusPost} from 'src/types/playbook_run';

import {navigateToUrl} from 'src/browser_routing';
import {
    actionSetGlobalSettings,
    openPlaybookRunModal,
    playbookArchived,
    playbookCreated,
    playbookRestored,
    playbookRunCreated,
    playbookRunUpdated,
    playbookUpdated,
    receivedTeamPlaybookRuns,
    removedFromPlaybookRunChannel,
    websocketPlaybookRunIncrementalUpdateReceived,
} from 'src/actions';
import {
    fetchGlobalSettings,
    fetchPlaybookRun,
    fetchPlaybookRunByChannel,
    fetchPlaybookRuns,
} from 'src/client';
import {
    clientId,
    getRun,
    globalSettings,
    myPlaybookRunsMap,
} from 'src/selectors';
import {PlaybookRunOpenModalPayload, PlaybookRunUpdate, PlaybookUpdatedPayload} from 'src/types/websocket_events';
export const websocketSubscribersToPlaybookRunUpdate = new Set<(playbookRun: PlaybookRun) => void>();

export function handleReconnect(getState: GetStateFunc, dispatch: Dispatch) {
    return async (): Promise<void> => {
        clearRunFetchSets();
        const currentTeam = getCurrentTeam(getState());
        const currentUserId = getCurrentUserId(getState());

        if (!currentTeam || !currentUserId) {
            return;
        }

        const fetched = await fetchPlaybookRuns({
            page: 0,
            per_page: 0,
            team_id: currentTeam.id,
            participant_id: currentUserId,
        });

        dispatch(receivedTeamPlaybookRuns(fetched.items));
    };
}

export function handleWebsocketPlaybookRunUpdated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }
        const data = JSON.parse(msg.data.payload);

        const playbookRun = data as PlaybookRun;
        dispatch(playbookRunUpdated(playbookRun));
        websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(playbookRun));
    };
}

// Handler for incremental updates - check state exists before dispatching
export function handleWebsocketPlaybookRunUpdatedIncremental(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        let data: PlaybookRunUpdate;
        try {
            data = JSON.parse(msg.data.payload) as PlaybookRunUpdate;
        } catch (error) {
            console.error('Failed to parse PlaybookRunUpdate WebSocket message:', error); // eslint-disable-line no-console
            return;
        }

        if (!data.id) {
            console.warn('Ignoring incremental update with missing ID'); // eslint-disable-line no-console
            return;
        }

        // Check if we have the run in state before applying incremental update
        const state = getState();
        const currentRun = getRun(data.id)(state);

        if (!currentRun) {
            // If we don't have the current state, fetch the full playbook run
            // This ensures we don't lose updates due to missing state
            fetchAndUpdatePlaybookRun(data.id, dispatch, getState);
            return;
        }

        dispatch(websocketPlaybookRunIncrementalUpdateReceived(data));
    };
}

export function handleWebsocketPlaybookRunCreated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }
        const payload = JSON.parse(msg.data.payload);
        const data = payload.playbook_run;
        const playbookRun = data as PlaybookRun;

        dispatch(playbookRunCreated(playbookRun));

        if (payload.client_id !== clientId(getState())) {
            return;
        }

        const currentTeam = getCurrentTeam(getState());

        if (!currentTeam) {
            return;
        }

        // Navigate to the newly created channel
        const pathname = `/${currentTeam.name}/channels/${payload.channel_name}`;
        const search = '?forceRHSOpen';
        navigateToUrl({pathname, search});
    };
}

export function handleWebsocketPlaybookCreated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const payload = JSON.parse(msg.data.payload);

        dispatch(playbookCreated(payload.teamID));
    };
}

export function handleWebsocketPlaybookArchived(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const payload = JSON.parse(msg.data.payload);

        dispatch(playbookArchived(payload.teamID));
    };
}

export function handleWebsocketPlaybookRestored(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        const payload = JSON.parse(msg.data.payload);

        dispatch(playbookRestored(payload.teamID));
    };
}

export function handleWebsocketPlaybookUpdated(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }
        try {
            const payload = JSON.parse(msg.data.payload) as PlaybookUpdatedPayload;
            if (!payload.teamID || !payload.playbookID) {
                return;
            }
            dispatch(playbookUpdated(payload.teamID, payload.playbookID));
        } catch {
            // ignore malformed payloads
        }
    };
}

export function handleWebsocketUserAdded(getState: GetStateFunc, dispatch: Dispatch) {
    return async (msg: WebSocketMessage<{ team_id: string, user_id: string }>) => {
        const currentUserId = getCurrentUserId(getState());
        const currentTeamId = getCurrentTeamId(getState());
        if (currentUserId === msg.data.user_id && currentTeamId === msg.data.team_id) {
            try {
                const playbookRun = await fetchPlaybookRunByChannel(msg.broadcast.channel_id);
                dispatch(receivedTeamPlaybookRuns([playbookRun]));
            } catch (error) {
                if (error.status_code !== 404) {
                    throw error;
                }
            }
        }
    };
}

export function handleWebsocketUserRemoved(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ channel_id: string, user_id: string }>) => {
        const currentUserId = getCurrentUserId(getState());
        if (currentUserId === msg.broadcast.user_id) {
            dispatch(removedFromPlaybookRunChannel(msg.data.channel_id));
        }
    };
}

async function getPlaybookRunFromStatusUpdate(post: Post): Promise<PlaybookRun | null> {
    let playbookRun: PlaybookRun;
    try {
        playbookRun = await fetchPlaybookRunByChannel(post.channel_id);
    } catch {
        return null;
    }

    if (playbookRun.status_posts.find((value: StatusPost) => post.id === value.id)) {
        return playbookRun;
    }

    return null;
}

export const handleWebsocketPostEditedOrDeleted = (getState: GetStateFunc, dispatch: Dispatch) => {
    return async (msg: WebSocketMessage<{ post: string }>) => {
        const playbookRunsMap = myPlaybookRunsMap(getState());
        if (playbookRunsMap[msg.broadcast.channel_id]) {
            const playbookRun = await getPlaybookRunFromStatusUpdate(JSON.parse(msg.data.post));
            if (playbookRun) {
                dispatch(playbookRunUpdated(playbookRun));
                websocketSubscribersToPlaybookRunUpdate.forEach((fn) => fn(playbookRun));
            }
        }
    };
};

export const handleWebsocketChannelUpdated = (getState: GetStateFunc, dispatch: Dispatch) => {
    return async (msg: WebSocketMessage<{ channel: string }>) => {
        const channel = JSON.parse(msg.data.channel);

        // Ignore updates to non-playbook run channels.
        const playbookRunsMap = myPlaybookRunsMap(getState());
        if (!playbookRunsMap[channel.id]) {
            return;
        }

        // Fetch the updated playbook run, since some metadata (like playbook run name) comes directly
        // from the channel, and the plugin cannot detect channel update events for itself.
        let playbookRun;
        try {
            playbookRun = await fetchPlaybookRunByChannel(channel.id);
        } catch {
            // Best-effort update; ignore fetch errors.
            return;
        }
        if (playbookRun) {
            dispatch(playbookRunUpdated(playbookRun));
        }
    };
};

// Track in-flight fetches per runId to avoid duplicate concurrent requests.
const runFetchInFlight = new Set<string>();

// Track runIds that received a WS event while a fetch was already in-flight.
// A follow-up fetch is issued after the current one settles so we don't drop updates.
const runFetchPendingRetry = new Set<string>();

export function clearRunFetchSets() {
    runFetchInFlight.clear();
    runFetchPendingRetry.clear();
}

function fetchAndUpdatePlaybookRun(runId: string, dispatch: Dispatch, getState: GetStateFunc) {
    if (runFetchInFlight.has(runId)) {
        // A fetch is already running; record that another event arrived so we
        // issue a follow-up fetch once the current one completes.
        runFetchPendingRetry.add(runId);
        return;
    }
    runFetchInFlight.add(runId);
    fetchPlaybookRun(runId)
        .then((playbookRun) => {
            const current = getRun(runId)(getState());
            if (!current || playbookRun.update_at > current.update_at) {
                dispatch(playbookRunUpdated(playbookRun));
            }
        })
        .catch(() => {
            // Best-effort update; ignore fetch errors to avoid surfacing noise to users.
        })
        .finally(() => {
            runFetchInFlight.delete(runId);
            if (runFetchPendingRetry.has(runId)) {
                runFetchPendingRetry.delete(runId);
                fetchAndUpdatePlaybookRun(runId, dispatch, getState);
            }
        });
}

let settingsFetchPromise: Promise<void> | null = null;

export function handleWebsocketSettingsChanged(getState: GetStateFunc, dispatch: Dispatch) {
    return async (msg: WebSocketMessage<{ payload: string }>): Promise<void> => {
        if (!msg.data.payload) {
            return;
        }

        const settingsUpdate = JSON.parse(msg.data.payload);
        const currentSettings = globalSettings(getState());
        if (currentSettings) {
            // Only merge known settings keys to prevent unexpected wire payload keys
            // from contaminating Redux state.
            const allowedKeys = ['enable_experimental_features'] as const;
            type AllowedKey = typeof allowedKeys[number];
            const safeUpdate = allowedKeys.reduce((acc, key) => {
                if (key in settingsUpdate) {
                    acc[key] = settingsUpdate[key as AllowedKey];
                }
                return acc;
            }, {} as Partial<typeof currentSettings>);
            const updatedSettings = {...currentSettings, ...safeUpdate};
            dispatch(actionSetGlobalSettings(updatedSettings));
        } else if (!settingsFetchPromise) {
            settingsFetchPromise = fetchGlobalSettings()
                .then((freshSettings) => {
                    dispatch(actionSetGlobalSettings(freshSettings));
                })
                .catch(() => {
                    // Best-effort; ignore fetch errors for settings.
                })
                .finally(() => {
                    settingsFetchPromise = null;
                });
        }
    };
}

export function handleWebsocketOpenRunModal(getState: GetStateFunc, dispatch: Dispatch) {
    return (msg: WebSocketMessage<{ payload: string }>): void => {
        if (!msg.data.payload) {
            return;
        }

        let payload: PlaybookRunOpenModalPayload;
        try {
            payload = JSON.parse(msg.data.payload) as PlaybookRunOpenModalPayload;
        } catch {
            return;
        }
        if (!payload.team_id || !payload.trigger_channel_id) {
            return;
        }
        dispatch(openPlaybookRunModal({
            teamId: payload.team_id,
            triggerChannelId: payload.trigger_channel_id,
            onRunCreated: () => { /* navigation handled by run created websocket event */ },
        }));
    };
}
