import {Store} from 'redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {generateId} from 'mattermost-redux/utils/helpers';

import {toggleRHS, setClientId, setRHSViewingList, setRHSViewingIncident} from 'src/actions';
import {inIncidentChannel, isIncidentRHSOpen, currentRHSState} from 'src/selectors';
import {RHSState} from 'src/types/rhs';

export function makeSlashCommandHook(store: Store<GlobalState>) {
    return (message: string, args = {}) => {
        let messageTrimmed;

        if (message) {
            messageTrimmed = message.trim();
        }

        if (messageTrimmed && messageTrimmed.startsWith('/incident start')) {
            const clientId = generateId();
            store.dispatch(setClientId(clientId));

            messageTrimmed = `/incident start ${clientId}`;

            return Promise.resolve({message: messageTrimmed, args});
        }

        if (messageTrimmed && messageTrimmed.startsWith('/incident info')) {
            const state = store.getState();

            if (inIncidentChannel(state) && !isIncidentRHSOpen(state)) {
                //@ts-ignore thunk
                store.dispatch(toggleRHS());
                return Promise.resolve({});
            }

            if (inIncidentChannel(state) && currentRHSState(state) !== RHSState.ViewingIncident) {
                //@ts-ignore thunk
                store.dispatch(setRHSViewingIncident());
                return Promise.resolve({});
            }

            return Promise.resolve({message: messageTrimmed, args});
        }

        if (messageTrimmed && messageTrimmed.startsWith('/incident list')) {
            const state = store.getState();

            if (!isIncidentRHSOpen(state)) {
                //@ts-ignore thunk
                store.dispatch(toggleRHS());
                return Promise.resolve({});
            }

            if (inIncidentChannel(state) && currentRHSState(state) !== RHSState.ViewingList) {
                store.dispatch(setRHSViewingList());
                return Promise.resolve({});
            }
            return Promise.resolve({error: {message: 'The list of your incidents is already open in the RHS'}});
        }

        return Promise.resolve({message, args});
    };
}
