import {Store} from 'redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {generateId} from 'mattermost-redux/utils/helpers';

import {toggleRHS, setClientId, setRHSViewingList, setRHSViewingPlaybookRun} from 'src/actions';
import {inPlaybookRunChannel, isPlaybookRunRHSOpen, currentRHSState} from 'src/selectors';
import {RHSState} from 'src/types/rhs';

export function makeSlashCommandHook(store: Store<GlobalState>) {
    return (message: any, args: any) => {
        let messageTrimmed = '';

        if (message && typeof message === 'string') {
            messageTrimmed = message.trim();
        }

        if (messageTrimmed && messageTrimmed.startsWith('/playbook start')) {
            const clientId = generateId();
            store.dispatch(setClientId(clientId));

            messageTrimmed = `/playbook start ${clientId}`;

            return Promise.resolve({message: messageTrimmed, args});
        }

        if (messageTrimmed && messageTrimmed.startsWith('/playbook info')) {
            const state = store.getState();

            if (inPlaybookRunChannel(state) && !isPlaybookRunRHSOpen(state)) {
                //@ts-ignore thunk
                store.dispatch(toggleRHS());
            }

            if (inPlaybookRunChannel(state) && currentRHSState(state) !== RHSState.ViewingPlaybookRun) {
                store.dispatch(setRHSViewingPlaybookRun());
            }

            return Promise.resolve({message: messageTrimmed, args});
        }

        if (messageTrimmed && messageTrimmed.startsWith('/playbook list')) {
            const state = store.getState();

            if (!isPlaybookRunRHSOpen(state)) {
                //@ts-ignore thunk
                store.dispatch(toggleRHS());
            }

            if (inPlaybookRunChannel(state) && currentRHSState(state) !== RHSState.ViewingList) {
                store.dispatch(setRHSViewingList());
            }

            return Promise.resolve({message: messageTrimmed, args});
        }

        return Promise.resolve({message, args});
    };
}
