import {useEffect, useState, MutableRefObject, useRef, useCallback} from 'react';
import {useSelector} from 'react-redux';

import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {PermissionsOptions} from 'mattermost-redux/selectors/entities/roles_helpers';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

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

/**
 * Hook that calls handler when targetKey is pressed.
 */
export function useKeyPress(targetKey: string, handler: () => void) {
    // Add event listeners
    useEffect(() => {
        // If pressed key is our target key then set to true
        function downHandler({key}: KeyboardEvent) {
            if (key === targetKey) {
                handler();
            }
        }

        window.addEventListener('keydown', downHandler);

        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener('keydown', downHandler);
        };
    }, [handler, targetKey]);
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
    }, [ref, handler]);
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

// useClientRect will be called only when the component mounts and unmounts, so changes to the
// component's size will not cause rect to change. If you want to be notified of changes after
// mounting, you will need to add ResizeObserver to this hook.
export function useClientRect() {
    const [rect, setRect] = useState(new DOMRect());

    const ref = useCallback((node) => {
        if (node !== null) {
            setRect(node.getBoundingClientRect());
        }
    }, []);

    return [rect, ref] as const;
}
