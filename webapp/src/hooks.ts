import {MutableRefObject, useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {PermissionsOptions} from 'mattermost-redux/selectors/entities/roles_helpers';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getProfilesInCurrentChannel, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getProfilesInChannel} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {Post} from 'mattermost-redux/types/posts';
import {getPost as getPostFromState} from 'mattermost-redux/selectors/entities/posts';

import {PROFILE_CHUNK_SIZE} from 'src/constants';
import {getProfileSetForChannel} from 'src/selectors';
import {Incident, StatusPost} from 'src/types/incident';

import {globalSettings} from './selectors';

export function useCurrentTeamPermission(options: PermissionsOptions): boolean {
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    options.team = currentTeam.id;
    return useSelector<GlobalState, boolean>((state) => haveITeamPermission(state, options));
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

export function useProfilesInCurrentChannel() {
    const dispatch = useDispatch() as DispatchFunc;
    const profilesInChannel = useSelector(getProfilesInCurrentChannel);
    const currentChannelId = useSelector(getCurrentChannelId);

    useEffect(() => {
        if (profilesInChannel.length > 0) {
            return;
        }

        dispatch(getProfilesInChannel(currentChannelId, 0, PROFILE_CHUNK_SIZE));
    }, [currentChannelId, profilesInChannel]);

    return profilesInChannel;
}

export function useCanCreatePlaybooks() {
    return useSelector<GlobalState, boolean>((state: GlobalState) => {
        const playbookCreators = globalSettings(state)?.playbook_creators_user_ids;
        if (!playbookCreators || playbookCreators.length === 0) {
            return true;
        }
        return playbookCreators.includes(getCurrentUserId(state));
    });
}

export function useProfilesInChannel(channelId: string) {
    const dispatch = useDispatch() as DispatchFunc;
    const profilesInChannel = useSelector((state) => getProfileSetForChannel(state as GlobalState, channelId));

    useEffect(() => {
        if (profilesInChannel.length > 0) {
            return;
        }

        dispatch(getProfilesInChannel(channelId, 0, PROFILE_CHUNK_SIZE));
    }, [channelId, profilesInChannel]);

    return profilesInChannel;
}

function useLatestPostId(statusPosts: StatusPost[]) {
    const sortedPosts = [...statusPosts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);

    return sortedPosts[0]?.id;
}

function usePostFromState(postId: string) {
    return useSelector<GlobalState, Post | null>((state) => getPostFromState(state, postId || ''));
}

export function usePost(postId: string) {
    const postFromState = usePostFromState(postId);
    const [post, setPost] = useState<Post | null>(null);

    useEffect(() => {
        const updateLatestUpdate = async () => {
            if (postFromState) {
                setPost(postFromState);
                return;
            }

            if (postId) {
                const fromServer = await Client4.getPost(postId);
                setPost(fromServer);
                return;
            }

            setPost(null);
        };

        updateLatestUpdate();
    }, [postFromState, postId]);

    return post;
}

export function useLatestUpdate(incident: Incident) {
    const postId = useLatestPostId(incident.status_posts);
    return usePost(postId);
}
