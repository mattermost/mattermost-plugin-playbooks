import {Store} from 'redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {generateId} from 'mattermost-redux/utils/helpers';

import {setClientId} from 'src/actions';

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

        return Promise.resolve({message, args});
    };
}
