import {Action, Store} from 'redux';
import {useEffect, useState} from 'react';

import {GlobalState} from 'mattermost-redux/types/store';

import {Channel} from 'mattermost-redux/types/channels';
import {Team} from 'mattermost-redux/types/teams';

import {useSelector} from 'react-redux';

import {generateId} from 'mattermost-redux/utils/helpers';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {PermissionsOptions, haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';

import {fetchIncidentWithDetailsByChannel} from 'src/client';

import {
    toggleRHS,
    setRHSState,
    getIncident,
    withLoading,
    getIncidentsForCurrentTeam,
    setClientId,
} from 'src/actions';
import {rhsOpen, activeIncidents, incidentDetails, incidentsTeamId} from 'src/selectors';
import {RHSState} from 'src/types/rhs';
import {websocketSubscribers} from 'src/websocket_events';

import {Incident} from './types/incident';

export function useCurrentTeamPermission(options: PermissionsOptions): boolean {
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    options.team = currentTeam.id;
    return useSelector<GlobalState, boolean>((state) => haveITeamPermission(state, options));
}

export enum CurrentIncidentState {
    Loading,
    NotFound,
    Loaded,
}

export function useCurrentIncident(): [Incident | null, CurrentIncidentState] {
    const currentChannel = useSelector<GlobalState, Channel>(getCurrentChannel);
    const [incident, setIncident] = useState<Incident | null>(null);
    const [state, setState] = useState<CurrentIncidentState>(CurrentIncidentState.Loading);

    const fetchIncident = async () => {
        try {
            setIncident(await fetchIncidentWithDetailsByChannel(currentChannel.id));
            setState(CurrentIncidentState.Loaded);
        } catch (err) {
            if (err.status_code === 404) {
                setState(CurrentIncidentState.NotFound);
            }
        }
    };

    useEffect(() => {
        setState(CurrentIncidentState.Loading);
        fetchIncident();
    }, [currentChannel.id]);

    useEffect(() => {
        const doUpdate = (updatedIncident: Incident) => {
            if (incident !== null && updatedIncident.id === incident.id) {
                setIncident(updatedIncident);
            }
        };
        websocketSubscribers.add(doUpdate);
        return () => {
            websocketSubscribers.delete(doUpdate);
        };
    }, [incident]);

    return [incident, state];
}

export interface Hooks {
    store: Store<object, Action<any>>;
    currentChannelId: string;
    currentTeamId: string;
    currentTeamIdForNewTeamHook: string;
}

export class Hooks {
    constructor(store: Store<object, Action<any>>) {
        this.store = store;
        this.store.subscribe(this.openCurrentIncidentRHS);
        this.currentChannelId = '';
        this.currentTeamId = '';

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

    public newTeamHook = () => {
        const state = this.store.getState();
        const currentTeam = getCurrentTeam(state);
        if (currentTeam && currentTeam.id !== this.currentTeamIdForNewTeamHook) {
            this.currentTeamIdForNewTeamHook = currentTeam.id;
            this.store.dispatch(setRHSState(RHSState.List));
        }
    }
}
