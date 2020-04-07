
import {Action, Store} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';

import {setClientId} from './actions';

export interface Hooks {
    store: Store<object, Action<any>>;
}

export class Hooks {
    constructor(store: Store<object, Action<any>>) {
        this.store = store;
    }

    public slashCommandWillBePostedHook = (message: string, args = {}) => {
        let messageTrimmed;
        if (message) {
            messageTrimmed = message.trim();
        }

        if (messageTrimmed && messageTrimmed.startsWith('/incident start')) {
            const clientId = generateId();
            this.store.dispatch(setClientId(clientId));

            messageTrimmed = `/incident start ${clientId}`;

            return Promise.resolve({message: messageTrimmed, args});
        }

        return Promise.resolve({message, args});
    };
}
