import {
    MutableRefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
    useMemo,
} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {DateTime} from 'luxon';

import {getCurrentTeam, getMyTeams, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {
    getProfilesInCurrentChannel,
    getCurrentUserId,
    getUser,
} from 'mattermost-redux/selectors/entities/users';
import {getCurrentChannelId, getChannelsNameMapInTeam, getChannel as getChannelFromState} from 'mattermost-redux/selectors/entities/channels';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getProfilesByIds, getProfilesInChannel} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getPost as getPostFromState} from 'mattermost-redux/selectors/entities/posts';
import {UserProfile} from 'mattermost-redux/types/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {haveITeamPermission} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/roles';

import {FetchPlaybookRunsParams, PlaybookRun} from 'src/types/playbook_run';
import {EmptyPlaybookStats} from 'src/types/stats';

import {PROFILE_CHUNK_SIZE} from 'src/constants';
import {getProfileSetForChannel, selectExperimentalFeatures} from 'src/selectors';
import {clientFetchPlaybooksCount, fetchPlaybookRuns, clientFetchPlaybook, fetchPlaybookRun, fetchPlaybookStats} from 'src/client';
import {receivedTeamNumPlaybooks} from 'src/actions';

import {
    isCloud,
    isE10LicensedOrDevelopment,
    isE20LicensedOrDevelopment,
} from '../license';
import {
    currentTeamNumPlaybooks,
    globalSettings,
    isCurrentUserAdmin,
    numPlaybooksByTeam,
    myPlaybookRunsByTeam,
} from '../selectors';

/**
 * Hook that calls handler when targetKey is pressed.
 */
export function useKeyPress(targetKey: string | ((e: KeyboardEvent) => boolean), handler: () => void) {
    const predicate: (e: KeyboardEvent) => boolean = useMemo(() => {
        if (typeof targetKey === 'string') {
            return (e: KeyboardEvent) => e.key === targetKey;
        }

        return targetKey;
    }, [targetKey]);

    // Add event listeners
    useEffect(() => {
        // If pressed key is our target key then set to true
        function downHandler(e: KeyboardEvent) {
            if (predicate(e)) {
                handler();
            }
        }

        window.addEventListener('keydown', downHandler);

        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener('keydown', downHandler);
        };
    }, [handler, predicate]);
}

/**
 * Hook that alerts clicks outside of the passed ref.
 */
export function useClickOutsideRef(
    ref: MutableRefObject<HTMLElement | null>,
    handler: () => void,
) {
    useEffect(() => {
        function onMouseDown(event: MouseEvent) {
            const target = event.target as any;
            if (
                ref.current &&
                target instanceof Node &&
                !ref.current.contains(target)
            ) {
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
            timeoutRef.current = window.setTimeout(
                () => callbackRef.current(),
                delay,
            );

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

export function useCanCreatePlaybooksOnAnyTeam() {
    const teams = useSelector(getMyTeams);
    return useSelector((state: GlobalState) => (
        teams.some((team: Team) => (
            haveITeamPermission(state, team.id, 'playbook_public_create') ||
			haveITeamPermission(state, team.id, 'playbook_private_create')
        ))
    ));
}

export function useCanRestrictPlaybookCreation() {
    const settings = useSelector(globalSettings);
    const isAdmin = useSelector(isCurrentUserAdmin);
    const currentUserID = useSelector(getCurrentUserId);

    // This is really a loading state so just assume no.
    if (!settings) {
        return false;
    }

    // No restrictions if user is a system administrator.
    if (isAdmin) {
        return true;
    }

    return settings.playbook_creators_user_ids.includes(currentUserID);
}

export function useExperimentalFeaturesEnabled() {
    return useSelector(selectExperimentalFeatures);
}

export function useProfilesInChannel(channelId: string) {
    const dispatch = useDispatch() as DispatchFunc;
    const profilesInChannel = useSelector((state) =>
        getProfileSetForChannel(state as GlobalState, channelId),
    );

    useEffect(() => {
        if (profilesInChannel.length > 0) {
            return;
        }

        dispatch(getProfilesInChannel(channelId, 0, PROFILE_CHUNK_SIZE));
    }, [channelId]);

    return profilesInChannel;
}

/**
 * Use thing from API and/or Store
 *
 * @param fetch required thing fetcher
 * @param select thing from store if available
 */
function useThing<T extends NonNullable<any>>(
    id: string,
    fetch: (id: string) => Promise<T>,
    select?: (state: GlobalState, id: string) => T,
) {
    const [thing, setThing] = useState<T | null>(null);
    const thingFromState = useSelector<GlobalState, T | null>((state) => select?.(state, id || '') ?? null);

    useEffect(() => {
        if (thingFromState) {
            setThing(thingFromState);
            return;
        }

        if (id) {
            fetch(id).then(setThing);
            return;
        }
        setThing(null);
    }, [thingFromState, id]);

    return thing;
}

export function usePost(postId: string) {
    return useThing(postId, Client4.getPost, getPostFromState);
}

export function useRun(runId: string, teamId?: string, channelId?: string) {
    return useThing(runId, fetchPlaybookRun, (state) => {
        const runsByTeam = myPlaybookRunsByTeam(state);
        if (teamId && channelId) {
            // use efficient path
            return runsByTeam[teamId]?.[channelId];
        }
        return Object.values(runsByTeam).flatMap((x) => x && Object.values(x)).find((run) => run?.id === runId);
    });
}

export function useChannel(channelId: string) {
    return useThing(channelId, Client4.getChannel, getChannelFromState);
}

export function useNumPlaybooksInCurrentTeam() {
    const dispatch = useDispatch();
    const team = useSelector(getCurrentTeam);
    const numPlaybooks = useSelector(currentTeamNumPlaybooks);

    useEffect(() => {
        const fetch = async () => {
            const response = await clientFetchPlaybooksCount(team.id);
            dispatch(receivedTeamNumPlaybooks(team.id, response?.count ?? 0));
        };

        fetch();
    }, [team.id]);

    return numPlaybooks;
}

export function useAllowPlaybookCreationInTeams() {
    const dispatch = useDispatch();
    const numPlaybooks = useSelector(numPlaybooksByTeam);
    const myTeams = useSelector(getMyTeams);
    const isLicensed = useSelector(isE10LicensedOrDevelopment);

    useEffect(() => {
        for (const team of myTeams) {
            const fetch = async () => {
                const response = await clientFetchPlaybooksCount(team.id);
                dispatch(receivedTeamNumPlaybooks(team.id, response?.count ?? 0));
            };
            fetch();
        }
    }, []);

    const allowPlaybookCreationInTeams = new Map<string, boolean>();
    for (const team of myTeams) {
        const num = numPlaybooks[team.id] || 0;
        allowPlaybookCreationInTeams.set(team.id, isLicensed || num === 0);
    }

    return allowPlaybookCreationInTeams;
}

export function useDropdownPosition(numOptions: number, optionWidth = 264) {
    const [dropdownPosition, setDropdownPosition] = useState({x: 0, y: 0, isOpen: false});

    const toggleOpen = (x: number, y: number) => {
        // height of the dropdown:
        const numOptionsShown = Math.min(6, numOptions);
        const selectBox = 56;
        const spacePerOption = 40;
        const bottomPadding = 12;
        const extraSpace = 20;
        const dropdownBottom = y + selectBox + spacePerOption + (numOptionsShown * spacePerOption) + bottomPadding + extraSpace;
        const deltaY = Math.max(0, dropdownBottom - window.innerHeight);

        const dropdownRight = x + optionWidth + extraSpace;
        const deltaX = Math.max(0, dropdownRight - window.innerWidth);

        const shiftedX = x - deltaX;
        const shiftedY = y - deltaY;
        setDropdownPosition({x: shiftedX, y: shiftedY, isOpen: !dropdownPosition.isOpen});
    };
    return [dropdownPosition, toggleOpen] as const;
}

// useAllowPlaybookCreationInCurrentTeam returns whether a user can create
// a playbook in the current team
export function useAllowPlaybookCreationInCurrentTeam() {
    const numPlaybooks = useNumPlaybooksInCurrentTeam();
    const isLicensed = useSelector(isE10LicensedOrDevelopment);

    return isLicensed || numPlaybooks === 0;
}

// useAllowTimelineViewInCurrentTeam returns whether a user can view the RHS
// timeline in the current team
export function useAllowTimelineViewInCurrentTeam() {
    return useSelector(isE10LicensedOrDevelopment);
}

// useAllowAddMessageToTimelineInCurrentTeam returns whether a user can add a
// post to the timeline in the current team
export function useAllowAddMessageToTimelineInCurrentTeam() {
    return useSelector(isE10LicensedOrDevelopment);
}

// useAllowPlaybookGranularAccess returns whether the access to specific playbooks
// can be restricted to a subset of users
export function useAllowPlaybookGranularAccess() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowPlaybookCreationRestriction returns whether the global feature to
// restrict the playbook creation to a subset of users is allowed
export function useAllowPlaybookCreationRestriction() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowChannelExport returns whether exporting the channel is allowed
export function useAllowChannelExport() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowPlaybookStatsView returns whether the server is licensed to show
// the stats in the playbook backstage dashboard
export function useAllowPlaybookStatsView() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowRetrospectiveAccess returns whether the server is licenced for
// the retrospective feature.
export function useAllowRetrospectiveAccess() {
    return useSelector(isE10LicensedOrDevelopment);
}

export function useEnsureProfiles(userIds: string[]) {
    const dispatch = useDispatch();
    type StringToUserProfileFn = (id: string) => UserProfile;
    const getUserFromStore = useSelector<GlobalState, StringToUserProfileFn>(
        (state) => (id: string) => getUser(state, id),
    );

    const unknownIds = [];
    for (const id of userIds) {
        const user = getUserFromStore(id);
        if (!user) {
            unknownIds.push(id);
        }
    }

    if (unknownIds.length > 0) {
        dispatch(getProfilesByIds(userIds));
    }
}

export function useOpenCloudModal() {
    const dispatch = useDispatch();
    const isServerCloud = useSelector(isCloud);

    if (!isServerCloud) {
        return () => {
            /*do nothing*/
        };
    }

    // @ts-ignore
    if (!window.WebappUtils?.modals?.openModal || !window.WebappUtils?.modals?.ModalIdentifiers?.CLOUD_PURCHASE || !window.Components?.PurchaseModal) {
        // eslint-disable-next-line no-console
        console.error('unable to open cloud modal');

        return () => {
            /*do nothing*/
        };
    }

    // @ts-ignore
    const {openModal, ModalIdentifiers} = window.WebappUtils.modals;

    // @ts-ignore
    const PurchaseModal = window.Components.PurchaseModal;

    return () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.CLOUD_PURCHASE,
                dialogType: PurchaseModal,
            }),
        );
    };
}

export function useFormattedUsername(user: UserProfile) {
    const teamnameNameDisplaySetting =
        useSelector<GlobalState, string | undefined>(
            getTeammateNameDisplaySetting,
        ) || '';

    return displayUsername(user, teamnameNameDisplaySetting);
}

export function useFormattedUsernameByID(userId: string) {
    const user = useSelector<GlobalState, UserProfile>((state) =>
        getUser(state, userId),
    );

    return useFormattedUsername(user);
}

export function useNow(refreshIntervalMillis = 1000) {
    const [now, setNow] = useState(DateTime.now());

    useEffect(() => {
        const tick = () => {
            setNow(DateTime.now());
        };
        const timerId = setInterval(tick, refreshIntervalMillis);

        return () => {
            clearInterval(timerId);
        };
    }, [refreshIntervalMillis]);

    return now;
}

export function useRunsList(defaultFetchParams: FetchPlaybookRunsParams):
[PlaybookRun[], number, FetchPlaybookRunsParams, React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>] {
    const [playbookRuns, setPlaybookRuns] = useState<PlaybookRun[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [fetchParams, setFetchParams] = useState(defaultFetchParams);

    useEffect(() => {
        let isCanceled = false;

        async function fetchPlaybookRunsAsync() {
            const playbookRunsReturn = await fetchPlaybookRuns(fetchParams);

            if (!isCanceled) {
                setPlaybookRuns(playbookRunsReturn.items);
                setTotalCount(playbookRunsReturn.total_count);
            }
        }

        fetchPlaybookRunsAsync();

        return () => {
            isCanceled = true;
        };
    }, [fetchParams]);

    return [playbookRuns, totalCount, fetchParams, setFetchParams];
}

export const usePlaybookName = (playbookId: string) => {
    const [playbookName, setPlaybookName] = useState('');

    useEffect(() => {
        const getPlaybookName = async () => {
            if (playbookId !== '') {
                try {
                    const playbook = await clientFetchPlaybook(playbookId);
                    setPlaybookName(playbook?.title || '');
                } catch {
                    setPlaybookName('');
                }
            }
        };

        getPlaybookName();
    }, [playbookId]);

    return playbookName;
};

export const useDefaultMarkdownOptions = (team: Team) => {
    const channelNamesMap = useSelector((state: GlobalState) => getChannelsNameMapInTeam(state, team.id));

    return {
        atMentions: true,
        mentionHighlight: true,
        team,
        channelNamesMap,
    };
};

export const useDefaultMarkdownOptionsByTeamId = (teamId: string) => {
    const team = useSelector((state: GlobalState) => getTeam(state, teamId));

    return useDefaultMarkdownOptions(team);
};

export const useStats = (playbookId: string) => {
    const [stats, setStats] = useState(EmptyPlaybookStats);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const ret = await fetchPlaybookStats(playbookId);
                setStats(ret);
            } catch {
                setStats(EmptyPlaybookStats);
            }
        };

        fetchStats();
    }, [playbookId]);

    return stats;
};

/**
 * Hook that returns the previous value of the prop passed as argument
 */
export const usePrevious = (value: any) => {
    const ref = useRef();

    useEffect(() => {
        ref.current = value;
    });

    return ref.current;
};
