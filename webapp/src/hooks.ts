import {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {PermissionsOptions} from 'mattermost-redux/selectors/entities/roles_helpers';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {Channel} from 'mattermost-redux/types/channels';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import {fetchIncidentWithDetailsByChannel} from 'src/client';
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

    useEffect(() => {
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
