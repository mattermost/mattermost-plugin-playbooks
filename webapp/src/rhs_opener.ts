// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Store} from 'redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {fetchIncidentChannels} from 'src/client';

import {isIncidentRHSOpen} from 'src/selectors';
import {toggleRHS} from 'src/actions';

export function makeRHSOpener(store: Store<GlobalState>): () => Promise<void> {
    let currentTeamId = '';
    let currentChannelId = '';
    let currentTeamIncidentChannels = new Set<string>();

    return async () => {
        const state = store.getState();
        const currentChannel = getCurrentChannel(state);
        const currentTeam = getCurrentTeam(state);

        //@ts-ignore Views not in global state
        const mmRhsOpen = state.views.rhs.isSidebarOpen;

        const incidentRHSOpen = isIncidentRHSOpen(state);
        if (
            !currentChannel ||
            !currentTeam ||
            (currentChannel.id === currentChannelId && currentTeamId === currentTeam.id) || // Don't do anything unless the channel has changed.
            (mmRhsOpen && !incidentRHSOpen) // Don't navigate away from an alternate sidebar that is open
        ) {
            // Not updating the current channel when we fail here means that we will retry if conditions improve.
            // So if the RHS is closed or the incident button is pressed the correct RHS will open.
            return;
        }

        if (currentTeamId !== currentTeam.id) {
            currentTeamId = currentTeam.id;
            currentTeamIncidentChannels = new Set<string>(await fetchIncidentChannels(currentTeam.id));
        }

        // Setting this only when everything else is done bcause once we set this
        // we won't try again to open the RHS
        currentChannelId = currentChannel.id;

        // Check if current channel is and incident channel.
        if (currentTeamIncidentChannels.has(currentChannelId)) {
            if (!incidentRHSOpen) {
                //@ts-ignore thunk
                store.dispatch(toggleRHS());
            }
        }
    };
}
