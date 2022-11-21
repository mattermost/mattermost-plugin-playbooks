// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {generateId} from 'mattermost-redux/utils/helpers';

import {Store} from 'src/types/store';

import {
    toggleRHS,
    setClientId,
    promptUpdateStatus,
} from 'src/actions';

import {
    inPlaybookRunChannel,
    isPlaybookRunRHSOpen,
    currentPlaybookRun,
} from 'src/selectors';

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
            const currentRun = currentPlaybookRun(state);
            if (currentRun) {
                const clientId = generateId();
                store.dispatch(setClientId(clientId));
                store.dispatch(promptUpdateStatus(currentRun.team_id, currentRun.id, currentRun.channel_id));
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

        if (message?.startsWith('/playbook list')) {
            if (!isPlaybookRunRHSOpen(state)) {
                //@ts-ignore thunk
                store.dispatch(toggleRHS());
            }

            return {message, args};
        }

        return {message: inMessage, args};
    };
}
