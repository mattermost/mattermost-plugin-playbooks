
import {Action, Store} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {toggleRHS, setRHSState, getIncident, withLoading, getIncidentsForCurrentTeam, setClientId} from 'src/actions';
import {rhsOpen, activeIncidents, incidentDetails, incidentsTeamId} from 'src/selectors';
import {RHSState} from 'src/types/rhs';

export interface Hooks {
    store: Store<object, Action<any>>;
    currentChannelId: string;
    currentTeamId: string;
}

export class Hooks {
    constructor(store: Store<object, Action<any>>) {
        this.store = store;
        this.store.subscribe(this.openCurrentIncidentRHS);
        this.currentChannelId = '';
        this.currentTeamId = '';
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

    public openCurrentIncidentRHS = () => {
        const state = this.store.getState();
        const currentChannel = getCurrentChannel(state);
        const currentTeam = getCurrentTeam(state);
        const mmRhsOpen = state.views.rhs.isSidebarOpen;
        const incidentRHSOpen = rhsOpen(state);
        if (
            !currentChannel ||
            !currentTeam ||
            (currentChannel.id === this.currentChannelId && this.currentTeamId === currentTeam.id) || // Don't do anything unless the channel has changed.
            (mmRhsOpen && !incidentRHSOpen) // Don't navigate away from an alternate sidebar that is open
        ) {
            // Not updating the current channel when we fail here means that we will retry if conditions improve.
            // So if the RHS is closed or the incident button is pressed the correct RHS will open.
            return;
        }

        const incidents = activeIncidents(state);
        const incidentsTeam = incidentsTeamId(state);
        if (!incidents || this.currentTeamId !== currentTeam.id) {
            this.currentTeamId = currentTeam.id;
            this.store.dispatch(getIncidentsForCurrentTeam());
            return;
        }

        if (incidentsTeam !== currentTeam.id) {
            return;
        }

        // Setting this only when everything else is done bcause once we set this
        // we won't try again to open the RHS
        this.currentChannelId = currentChannel.id;

        const currentIncident = incidentDetails(state);
        for (let i = 0; i < incidents.length; i++) {
            if (incidents[i].primary_channel_id === currentChannel.id) {
                // Only load if it's not the current incident.
                if (!currentIncident || currentIncident.id !== incidents[i].id) {
                    this.store.dispatch(withLoading(getIncident(incidents[i].id)));
                }

                this.store.dispatch(setRHSState(RHSState.Details));

                // Make sure the RHS is open.
                if (!incidentRHSOpen) {
                    this.store.dispatch(toggleRHS());
                }
                break;
            }
        }
    }
}
