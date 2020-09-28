// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Store} from 'redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {receivedTeamIncidentChannels, setRHSState, toggleRHS} from 'src/actions';
import {fetchIncidentChannels} from 'src/client';
import {isIncidentChannel, isIncidentRHSOpen} from 'src/selectors';

export function makeRHSOpener(store: Store<GlobalState>): () => Promise<void> {
    let currentTeamId = '';
    let currentChannelId = '';
    let currentChannelIsIncident = false;

    return async () => {
        const state = store.getState();
        const currentChannel = getCurrentChannel(state);
        const currentTeam = getCurrentTeam(state);

        //@ts-ignore Views not in global state
        const mmRhsOpen = state.views.rhs.isSidebarOpen;

        // Wait for a valid team and channel before doing anything.
        if (!currentChannel || !currentTeam) {
            return;
        }

        // Update the known set of incident channels whenever the team changes.
        if (currentTeamId !== currentTeam.id) {
            currentTeamId = currentTeam.id;
            store.dispatch(receivedTeamIncidentChannels(await fetchIncidentChannels(currentTeam.id)));
        }

        // Only consider opening the RHS if the channel has changed and wasn't already seen as
        // an incident.
        if (currentChannel.id === currentChannelId && currentChannelIsIncident) {
            return;
        }
        currentChannelId = currentChannel.id;
        currentChannelIsIncident = isIncidentChannel(state, currentChannelId);

        // Don't do anything if the incident RHS is already open.
        if (isIncidentRHSOpen(state)) {
            return;
        }

        // Don't navigate away from an alternate sidebar that is open.
        if (mmRhsOpen) {
            return;
        }

        // Don't do anything unless we're in an incident channel.
        if (!currentChannelIsIncident) {
            return;
        }

        //@ts-ignore thunk
        store.dispatch(toggleRHS());
    };
}
