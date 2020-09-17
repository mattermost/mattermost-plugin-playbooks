import {useEffect, useState, MutableRefObject, useRef} from 'react';
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

    const currentChannelId = currentChannel?.id;
    useEffect(() => {
        const fetchIncident = async () => {
            if (!currentChannelId) {
                setIncident(null);
                setState(CurrentIncidentState.NotFound);
                return;
            }

            try {
                setIncident(await fetchIncidentByChannel(currentChannelId));
                setState(CurrentIncidentState.Loaded);
            } catch (err) {
                if (err.status_code === 404) {
                    setIncident(null);
                    setState(CurrentIncidentState.NotFound);
                }
            }
        };
        setState(CurrentIncidentState.Loading);
        fetchIncident();
    }, [currentChannelId]);

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
