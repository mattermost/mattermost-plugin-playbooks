import {useEffect, useState, MutableRefObject, useRef} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {PermissionsOptions} from 'mattermost-redux/selectors/entities/roles_helpers';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {Channel} from 'mattermost-redux/types/channels';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {UserProfile} from 'mattermost-redux/types/users';

import {fetchIncidentByChannel, fetchIncidents} from 'src/client';
import {
    websocketSubscribersToIncidentCreate,
    websocketSubscribersToIncidentUpdate,
    websocketSubscribersToUserAdded,
    websocketSubscribersToUserRemoved,
} from 'src/websocket_events';
import {Incident} from 'src/types/incident';
import {incidentChannels} from 'src/selectors';
import {UserAdded, UserRemoved} from 'src/types/websocket_events';

export function useCurrentTeamPermission(options: PermissionsOptions): boolean {
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    options.team = currentTeam.id;
    return useSelector<GlobalState, boolean>((state) => haveITeamPermission(state, options));
}

export enum IncidentFetchState {
    Loading,
    NotFound,
    Loaded,
}

export function useCurrentIncident(): [Incident | null, IncidentFetchState] {
    const currentChannel = useSelector<GlobalState, Channel>(getCurrentChannel);
    const [incident, setIncident] = useState<Incident | null>(null);
    const [state, setState] = useState<IncidentFetchState>(IncidentFetchState.Loading);

    const currentChannelId = currentChannel?.id;
    useEffect(() => {
        const fetchIncident = async () => {
            if (!currentChannelId) {
                setIncident(null);
                setState(IncidentFetchState.NotFound);
                return;
            }

            try {
                setIncident(await fetchIncidentByChannel(currentChannelId));
                setState(IncidentFetchState.Loaded);
            } catch (err) {
                if (err.status_code === 404) {
                    setIncident(null);
                    setState(IncidentFetchState.NotFound);
                }
            }
        };
        setState(IncidentFetchState.Loading);
        fetchIncident();
    }, [currentChannelId]);

    useEffect(() => {
        const doUpdate = (updatedIncident: Incident) => {
            if (incident !== null && updatedIncident.id === incident.id) {
                setIncident(updatedIncident);
            }
        };
        websocketSubscribersToIncidentUpdate.add(doUpdate);
        return () => {
            websocketSubscribersToIncidentUpdate.delete(doUpdate);
        };
    }, [incident]);

    return [incident, state];
}

export enum ListFetchState {
    Loading,
    NotFound,
    Loaded,
}

export function useCurrentIncidentList(): [Incident[] | null, ListFetchState] {
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const currentUser = useSelector<GlobalState, UserProfile>(getCurrentUser);
    const myIncidentChannels = useSelector<GlobalState, Record<string, boolean>>(incidentChannels);
    const [incidents, setIncidents] = useState<Incident[] | null>(null);
    const [state, setState] = useState<ListFetchState>(ListFetchState.Loading);

    const currentTeamId = currentTeam?.id;
    const currentUserId = currentUser?.id;
    useEffect(() => {
        const fetchData = async () => {
            if (!currentTeamId) {
                setIncidents(null);
                setState(ListFetchState.NotFound);
                return;
            }

            try {
                const result = await fetchIncidents({
                    member_id: currentUserId,
                    team_id: currentTeamId,
                    sort: 'create_at',
                    order: 'desc',
                    status: 'active',
                });

                setIncidents(result.items);
                setState(ListFetchState.Loaded);
            } catch (err) {
                if (err.status_code === 404) {
                    setIncidents(null);
                    setState(ListFetchState.NotFound);
                }
            }
        };
        setState(ListFetchState.Loading);
        fetchData();
    }, [currentTeamId, currentUserId]);

    useEffect(() => {
        const onUpdate = (updatedIncident: Incident) => {
            if (updatedIncident.is_active &&
                updatedIncident.team_id === currentTeamId &&
                myIncidentChannels[updatedIncident.channel_id]
            ) {
                if (incidents) {
                    let newIncidents = incidents.map((incident) => {
                        if (incident.id === updatedIncident.id) {
                            return updatedIncident;
                        }
                        return incident;
                    });
                    newIncidents = sortIncidentsDescByCreateAt(newIncidents);
                    setIncidents(newIncidents);
                }
            }
        };
        websocketSubscribersToIncidentUpdate.add(onUpdate);

        const onCreate = (newIncident: Incident) => {
            if (newIncident.is_active && newIncident.team_id === currentTeamId) {
                let newIncidents = incidents ? [newIncident, ...incidents] : [newIncident];
                newIncidents = sortIncidentsDescByCreateAt(newIncidents);
                setIncidents(newIncidents);
            }
        };
        websocketSubscribersToIncidentCreate.add(onCreate);

        const onAdded = async (userAdded: UserAdded) => {
            if (userAdded.user_id === currentUserId && userAdded.team_id === currentTeamId) {
                const newIncident = await fetchIncidentByChannel(userAdded.channel_id);
                let newIncidents = incidents ? [newIncident, ...incidents] : [newIncident];
                newIncidents = sortIncidentsDescByCreateAt(newIncidents);
                setIncidents(newIncidents);
            }
        };
        websocketSubscribersToUserAdded.add(onAdded);

        const onRemoved = (userRemoved: UserRemoved) => {
            if (userRemoved.user_id === currentUserId && myIncidentChannels[userRemoved.channel_id]) {
                if (incidents) {
                    const newIncidents = incidents.filter((i) => i.channel_id !== userRemoved.channel_id);
                    setIncidents(newIncidents);
                }
            }
        };
        websocketSubscribersToUserRemoved.add(onRemoved);

        return () => {
            websocketSubscribersToIncidentUpdate.delete(onUpdate);
            websocketSubscribersToIncidentCreate.delete(onCreate);
            websocketSubscribersToUserAdded.delete(onAdded);
            websocketSubscribersToUserAdded.delete(onRemoved);
        };
    }, [incidents, currentUserId, currentTeamId, myIncidentChannels]);

    return [incidents, state];
}

function sortIncidentsDescByCreateAt(incidents: Incident[]) {
    return incidents.sort((a, b) => b.create_at - a.create_at);
}

/**
 * Hook that calls handler when targetKey is pressed.
 */
export function useKeyPress(targetKey: string, handler: () => void) {
    // If pressed key is our target key then set to true
    function downHandler({key}: KeyboardEvent) {
        if (key === targetKey) {
            handler();
        }
    }

    // Add event listeners
    useEffect(() => {
        window.addEventListener('keydown', downHandler);

        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener('keydown', downHandler);
        };
    }, []); // Empty array ensures that effect is only run on mount and unmount
}

/**
 * Hook that alerts clicks outside of the passed ref.
 */
export function useClickOutsideRef(ref: MutableRefObject<HTMLElement | null>, handler: () => void) {
    useEffect(() => {
        function onMouseDown(event: MouseEvent) {
            const target = event.target as any;
            if (ref.current && target instanceof Node && !ref.current.contains(target)) {
                handler();
            }
        }

        // Bind the event listener
        document.addEventListener('mousedown', onMouseDown);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, [ref]);
}

/**
 * Hook that sets a timeout and will cleanup after itself. Adapted from Dan Abramov's code:
 * https://overreacted.io/making-setinterval-declarative-with-react-hooks/
 */
export function useTimeout(callback: () => void, delay: number | null) {
    const timeoutRef = useRef<number>();
    const callbackRef = useRef(callback);

    // Remember the latest callback:
    //
    // Without this, if you change the callback, when setTimeout kicks in, it
    // will still call your old callback.
    //
    // If you add `callback` to useEffect's deps, it will work fine but the
    // timeout will be reset.
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Set up the timeout:
    useEffect(() => {
        if (typeof delay === 'number') {
            timeoutRef.current = window.setTimeout(() => callbackRef.current(), delay);

            // Clear timeout if the component is unmounted or the delay changes:
            return () => window.clearTimeout(timeoutRef.current);
        }
        return () => false;
    }, [delay]);

    // In case you want to manually clear the timeout from the consuming component...:
    return timeoutRef;
}
