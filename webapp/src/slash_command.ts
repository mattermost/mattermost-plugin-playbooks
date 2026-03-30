// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {generateId} from 'mattermost-redux/utils/helpers';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {Store} from 'src/types/store';
import {
    openPlaybookRunModal,
    promptUpdateStatus,
    setClientId,
    toggleRHS,
} from 'src/actions';
import {inPlaybookRunChannel, isPlaybookRunRHSOpen} from 'src/selectors';
import {navigateToPluginUrl} from 'src/browser_routing';

import {fetchPlaybookRunsForChannelByUser} from './client';

type SlashCommandObj = {message?: string; args?: string[];} | {error: string;} | object;

export function makeSlashCommandHook(store: Store) {
    return async (inMessage: any, args: any): Promise<SlashCommandObj> => {
        const state = store.getState();
        const message = inMessage && typeof inMessage === 'string' ? inMessage.trim() : null;

        if (message?.startsWith('/playbook run')) {
            const teamId = getCurrentTeamId(state);
            const channelId = getCurrentChannelId(state);
            store.dispatch(openPlaybookRunModal({
                teamId,
                triggerChannelId: channelId,
                onRunCreated: (runId: string) => {
                    navigateToPluginUrl(`/runs/${runId}?from=run_modal`);
                },
            }));
            return {};
        }

        if (message?.startsWith('/playbook update') && inPlaybookRunChannel(state)) {
            const currentChannel = getCurrentChannelId(state);
            if (currentChannel) {
                const playbookRuns = await fetchPlaybookRunsForChannelByUser(currentChannel);
                const clientId = generateId();
                store.dispatch(setClientId(clientId));

                const runNumber = message.substring(16);

                // no runs, propagate so server could handle this command and post ephemeral message
                if (!playbookRuns || playbookRuns?.length === 0) {
                    return {message: inMessage, args};
                }

                const multipleRuns = playbookRuns?.length > 1;

                // multiple runs, mussing run number
                if (multipleRuns && runNumber === '') {
                    return {message: inMessage, args};
                }

                let run = 0;
                if (multipleRuns) {
                    run = parseInt(runNumber, 10);

                    // run number parsing error
                    if (isNaN(run)) {
                        return {message: inMessage, args};
                    }

                    // invalid run number
                    if (run < 0 || run >= playbookRuns.length) {
                        return {message: inMessage, args};
                    }
                }

                store.dispatch(promptUpdateStatus(playbookRuns[run].team_id, playbookRuns[run].id, currentChannel));
                return {};
            }
        }

        if (message?.startsWith('/playbook info')) {
            if (inPlaybookRunChannel(state) && !isPlaybookRunRHSOpen(state)) {
                //@ts-ignore thunk
                store.dispatch(toggleRHS());
            }

            return {message, args};
        }

        return {message: inMessage, args};
    };
}
