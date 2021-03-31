// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Store} from 'redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {fetchIncidents} from 'src/client';

import {isIncidentRHSOpen, inIncidentChannel} from 'src/selectors';
import {toggleRHS, receivedTeamIncidents, receivedDisabledOnTeam} from 'src/actions';

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

        // Update the known set of incidents whenever the team changes.
        if (currentTeamId !== currentTeam.id) {
            currentTeamId = currentTeam.id;
            const currentUserId = getCurrentUserId(state);
            const fetched = await fetchIncidents({
                team_id: currentTeam.id,
                member_id: currentUserId,
            });
            if (fetched.disabled) {
                store.dispatch(receivedDisabledOnTeam(currentTeam.id));
            } else {
                store.dispatch(receivedTeamIncidents(fetched.items));
            }
        }

        // Only consider opening the RHS if the channel has changed and wasn't already seen as
        // an incident.
        if (currentChannel.id === currentChannelId && currentChannelIsIncident) {
            return;
        }
        currentChannelId = currentChannel.id;
        currentChannelIsIncident = inIncidentChannel(state);

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
