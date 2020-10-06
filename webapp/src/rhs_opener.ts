// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {Store} from 'redux';

import {fetchingIncidents, receivedTeamIncidents, setRHSState, toggleRHS} from 'src/actions';
import {fetchIncidents} from 'src/client';
import {currentlyFetchingIncidents, isIncidentChannel, isIncidentRHSOpen} from 'src/selectors';
import {RHSState} from 'src/types/rhs';

export function makeRHSOpener(store: Store<GlobalState>): () => Promise<void> {
    let currentTeamId = '';
    let currentChannelId = '';
    let sentRHSStateForChannelId = '';
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

        // Update the known set of incidents whenever the team changes.
        if (currentTeamId !== currentTeam.id) {
            currentTeamId = currentTeam.id;
            store.dispatch(fetchingIncidents(true));
            const currentUserId = getCurrentUserId(state);
            const fetched = await fetchIncidents({team_id: currentTeam.id, member_id: currentUserId});
            store.dispatch(fetchingIncidents(false));
            store.dispatch(receivedTeamIncidents(fetched.items));
        }

        // Only consider opening the RHS if the channel has changed and wasn't already seen as
        // an incident.
        if (currentChannel.id === currentChannelId && currentChannelIsIncident) {
            return;
        }
        currentChannelId = currentChannel.id;
        currentChannelIsIncident = isIncidentChannel(state, currentChannelId);

        // Decide whether to show the Incident Details or Incident List view when we change channels
        if (sentRHSStateForChannelId !== currentChannelId) {
            sentRHSStateForChannelId = currentChannelId;
            if (currentChannelIsIncident || currentlyFetchingIncidents(state)) {
                store.dispatch(setRHSState(RHSState.ViewingIncident));
            } else {
                store.dispatch(setRHSState(RHSState.ViewingList));
            }
        }

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
