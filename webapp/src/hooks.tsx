import {Action, Store} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {RHSState} from 'src/types/rhs';

import {setClientId, setRHSState} from './actions';

export interface Hooks {
    store: Store<object, Action<any>>;
    currentTeamIdForNewTeamHook: string;
}

export class Hooks {
    constructor(store: Store<object, Action<any>>) {
        this.store = store;
        this.store.subscribe(this.newTeamHook);
        this.currentTeamIdForNewTeamHook = '';
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

    public newTeamHook = () => {
        const state = this.store.getState();
        const currentTeam = getCurrentTeam(state);
        if (currentTeam && currentTeam.id !== this.currentTeamIdForNewTeamHook) {
            this.currentTeamIdForNewTeamHook = currentTeam.id;
            this.store.dispatch(setRHSState(RHSState.List));
        }
    }
}
