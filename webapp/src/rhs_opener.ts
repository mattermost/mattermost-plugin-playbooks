// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Store} from 'redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {fetchPlaybookRuns} from 'src/client';

import {isPlaybookRunRHSOpen, inPlaybookRunChannel} from 'src/selectors';
import {toggleRHS, receivedTeamPlaybookRuns, receivedDisabledOnTeam} from 'src/actions';

export function makeRHSOpener(store: Store<GlobalState>): () => Promise<void> {
    let currentTeamId = '';
    let currentChannelId = '';
    let currentChannelIsPlaybookRun = false;

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

        // Update the known set of playbook runs whenever the team changes.
        if (currentTeamId !== currentTeam.id) {
            currentTeamId = currentTeam.id;
            const currentUserId = getCurrentUserId(state);
            const fetched = await fetchPlaybookRuns({
                team_id: currentTeam.id,
                member_id: currentUserId,
            });
            if (fetched.disabled) {
                store.dispatch(receivedDisabledOnTeam(currentTeam.id));
            } else {
                store.dispatch(receivedTeamPlaybookRuns(fetched.items));
            }
        }

        // Only consider opening the RHS if the channel has changed and wasn't already seen as
        // a playbook run.
        if (currentChannel.id === currentChannelId && currentChannelIsPlaybookRun) {
            return;
        }
        currentChannelId = currentChannel.id;
        currentChannelIsPlaybookRun = inPlaybookRunChannel(state);

        // Don't do anything if the playbook run RHS is already open.
        if (isPlaybookRunRHSOpen(state)) {
            return;
        }

        // Don't navigate away from an alternate sidebar that is open.
        if (mmRhsOpen) {
            return;
        }

        // Don't do anything unless we're in an playbook run channel.
        if (!currentChannelIsPlaybookRun) {
            return;
        }

        //@ts-ignore thunk
        store.dispatch(toggleRHS());
    };
}
