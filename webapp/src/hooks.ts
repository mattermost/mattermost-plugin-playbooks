import {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {PermissionsOptions} from 'mattermost-redux/selectors/entities/roles_helpers';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {Channel} from 'mattermost-redux/types/channels';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import {fetchIncidentByChannel} from 'src/client';
import {websocketSubscribers} from 'src/websocket_events';
import {navigateToUrl} from 'src/browser_routing';

import {clientId as clientIdSelector} from './selectors';

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
    const currentClientId = useSelector<GlobalState, string>(clientIdSelector);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const [incident, setIncident] = useState<Incident | null>(null);
    const [state, setState] = useState<CurrentIncidentState>(CurrentIncidentState.Loading);

    useEffect(() => {
        const fetchIncident = async () => {
            if (!currentChannel) {
                setState(CurrentIncidentState.NotFound);
                return;
            }

            try {
                setIncident(await fetchIncidentByChannel(currentChannel.id));
                setState(CurrentIncidentState.Loaded);
            } catch (err) {
                if (err.status_code === 404) {
                    setState(CurrentIncidentState.NotFound);
                }
            }
        };
        setState(CurrentIncidentState.Loading);
        fetchIncident();
    }, [currentChannel?.id]);

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

    useEffect(() => {
        const doChannelSwitch = (createdIncident: Incident, clientId?: string) => {
            if (clientId !== currentClientId) {
                return;
            }

            // Navigate to the newly created channel
            const url = `/${currentTeam.name}/channels/${createdIncident.primary_channel_id}`;
            navigateToUrl(url);
        };
        websocketSubscribers.add(doChannelSwitch);
        return () => {
            websocketSubscribers.delete(doChannelSwitch);
        };
    });

    return [incident, state];
}
