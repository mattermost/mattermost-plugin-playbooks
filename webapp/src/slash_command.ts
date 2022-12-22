// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {generateId} from 'mattermost-redux/utils/helpers';
import {getCurrentChannelId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/common';

import {Store} from 'src/types/store';
import {promptUpdateStatus, setClientId, toggleRHS} from 'src/actions';
import {inPlaybookRunChannel, isPlaybookRunRHSOpen} from 'src/selectors';

import {fetchPlaybookRunsForChannelByUser, postEphemeralPost} from './client';

type SlashCommandObj = {message?: string; args?: string[];} | {error: string;} | {};

export function makeSlashCommandHook(store: Store) {
    return async (inMessage: any, args: any): Promise<SlashCommandObj> => {
        const state = store.getState();
        const message = inMessage && typeof inMessage === 'string' ? inMessage.trim() : null;

        if (message?.startsWith('/playbook run')) {
            const clientId = generateId();
            store.dispatch(setClientId(clientId));

            return {message: `/playbook run ${clientId}`, args};
        }

        if (message?.startsWith('/playbook update') && inPlaybookRunChannel(state)) {
            const currentChannel = getCurrentChannelId(state);
            if (currentChannel) {
                const playbookRuns = await fetchPlaybookRunsForChannelByUser(currentChannel);
                const clientId = generateId();
                store.dispatch(setClientId(clientId));

                const runNumber = message.substring(16);
                const multipleRuns = playbookRuns?.length > 1;
                if (multipleRuns && runNumber === '') {
                    postEphemeralPost(currentChannel, 'Command expects one argument: the run number.');
                    return {};
                }

                let run = 0;
                if (multipleRuns) {
                    run = parseInt(runNumber, 10);
                    if (isNaN(run)) {
                        postEphemeralPost(currentChannel, 'Error parsing the first argument. Must be a number.');
                        return {};
                    }

                    if (run < 0 || run >= playbookRuns.length) {
                        postEphemeralPost(currentChannel, 'Invalid run number.');
                        return {};
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
