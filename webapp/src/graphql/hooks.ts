// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import {playbookRunUpdated} from 'src/actions';
import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';
import {notifyRHSRefresh} from 'src/rhs_refresh';
import {
    PlaybookUpdateFields,
    RunUpdateFields,
    addPlaybookMember,
    addRunParticipants,
    autoFollowPlaybook,
    clientFetchPlaybook,
    fetchPlaybookPropertyField,
    isFavoriteItem,
    removePlaybookMember,
    removeRunParticipants,
    setChecklistItemTaskActions,
    setOwner,
    setPlaybookFavorite,
    setRunFavorite,
    setRunPropertyValue as setRunPropertyValueRequest,
    updatePlaybook as updatePlaybookRequest,
    updatePlaybookRun,
} from 'src/client';
import {useAppDispatch} from 'src/hooks/redux';
import {PlaybookWithChecklist, TaskAction} from 'src/types/playbook';
import {PropertyField} from 'src/types/properties';

export type FullPlaybook = PlaybookWithChecklist | undefined

export type PlaybookPropertyField = PropertyField | undefined

export type Loaded<T> = Exclude<T, undefined | null>

type PlaybookFetchResult = {
    loading: boolean;
    error?: Error | null;
    refetch: () => Promise<void>;
}

const playbookRefreshListeners = new Map<string, Set<() => void>>();

function subscribePlaybookRefresh(id: string, listener: () => void): () => void {
    let listeners = playbookRefreshListeners.get(id);
    if (!listeners) {
        listeners = new Set();
        playbookRefreshListeners.set(id, listeners);
    }
    listeners.add(listener);
    return () => {
        listeners?.delete(listener);
        if (listeners && listeners.size === 0) {
            playbookRefreshListeners.delete(id);
        }
    };
}

function notifyPlaybookRefresh(id: string) {
    playbookRefreshListeners.get(id)?.forEach((listener) => listener());
}

async function fetchFullPlaybook(id: string): Promise<PlaybookWithChecklist> {
    const playbook = await clientFetchPlaybook(id);
    if (!playbook) {
        throw new Error(`playbook ${id} not found`);
    }
    try {
        const isFavorite = await isFavoriteItem(playbook.team_id, id, 'p');
        return {...playbook, is_favorite: Boolean(isFavorite)};
    } catch {
        return {...playbook, is_favorite: Boolean(playbook.is_favorite)};
    }
}

export const usePlaybook = (id: string): [FullPlaybook, PlaybookFetchResult] => {
    const [playbook, setPlaybook] = useState<PlaybookWithChecklist | undefined>();
    const [loading, setLoading] = useState(Boolean(id));
    const [error, setError] = useState<Error | null | undefined>();
    const [refreshKey, setRefreshKey] = useState(0);

    // Tracks which playbook id is currently shown so refreshes keep prior data
    // mounted (Apollo useQuery parity). Flipping loading on every refresh was
    // unmounting the editor and wiping optimistic toggle state.
    const loadedIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!id) {
            return undefined;
        }
        return subscribePlaybookRefresh(id, () => setRefreshKey((key) => key + 1));
    }, [id]);

    const refetch = useCallback(async () => {
        if (!id) {
            return;
        }

        // Await the fetch itself so callers (e.g. serialized metric saves) can
        // chain on completion rather than racing a fire-and-forget refreshKey bump.
        try {
            const result = await fetchFullPlaybook(id);
            loadedIdRef.current = id;
            setPlaybook(result);
            setLoading(false);
            setError(undefined);
        } catch (err) {
            loadedIdRef.current = undefined;
            setPlaybook(undefined);
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
            throw err;
        }
    }, [id]);

    useEffect(() => {
        let cancelled = false;
        if (!id) {
            loadedIdRef.current = undefined;
            setPlaybook(undefined);
            setLoading(false);
            setError(undefined);
            return undefined;
        }

        const isInitialLoad = loadedIdRef.current !== id;
        if (isInitialLoad) {
            if (loadedIdRef.current !== undefined) {
                setPlaybook(undefined);
            }
            setLoading(true);
        }
        setError(undefined);
        fetchFullPlaybook(id)
            .then((result) => {
                if (!cancelled) {
                    loadedIdRef.current = id;
                    setPlaybook(result);
                    setLoading(false);
                }
            })
            .catch((err: Error) => {
                if (!cancelled) {
                    loadedIdRef.current = undefined;
                    setPlaybook(undefined);
                    setError(err);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [id, refreshKey]);

    return [playbook, {loading, error, refetch}];
};

export const useUpdatePlaybook = (id?: string) => {
    return useCallback(async (updates: PlaybookUpdateFields) => {
        if (!id) {
            return;
        }
        await updatePlaybookRequest(id, updates);
        notifyPlaybookRefresh(id);
    }, [id]);
};

export const useUpdatePlaybookFavorite = (id: string|undefined) => {
    const refreshLHS = useLHSRefresh();

    return useCallback(async (favorite: boolean) => {
        if (id === undefined) {
            return;
        }
        await setPlaybookFavorite(id, favorite);
        refreshLHS();
        notifyPlaybookRefresh(id);
    }, [id, refreshLHS]);
};

export const useUpdateRun = (id?: string) => {
    const dispatch = useAppDispatch();
    const refreshLHS = useLHSRefresh();

    return useCallback(async (updates: RunUpdateFields) => {
        if (!id) {
            return;
        }
        const updated = await updatePlaybookRun(id, updates);
        dispatch(playbookRunUpdated(updated));
        refreshLHS();
        notifyRHSRefresh();
    }, [dispatch, id, refreshLHS]);
};

export const useSetRunFavorite = (id: string|undefined) => {
    const refreshLHS = useLHSRefresh();

    return useCallback(async (fav: boolean) => {
        if (id === undefined) {
            return;
        }
        await setRunFavorite(id, fav);
        refreshLHS();
    }, [id, refreshLHS]);
};

export const usePlaybookMembership = (playbookID?: string, userID?: string) => {
    const refreshLHS = useLHSRefresh();

    const join = useCallback(async () => {
        if (!playbookID || !userID) {
            return;
        }
        await addPlaybookMember(playbookID, userID);

        // Refresh LHS as soon as membership succeeds so a failed auto-follow
        // cannot leave the joined playbook missing from the sidebar.
        refreshLHS();
        await autoFollowPlaybook(playbookID, userID);
    }, [playbookID, refreshLHS, userID]);

    const leave = useCallback(async () => {
        if (!playbookID || !userID) {
            return;
        }
        await removePlaybookMember(playbookID, userID);
        refreshLHS();
    }, [playbookID, refreshLHS, userID]);

    return {join, leave};
};

export const useManageRunMembership = (runID?: string) => {
    const dispatch = useAppDispatch();
    const refreshLHS = useLHSRefresh();

    const addToRun = useCallback(async (userIDs?: string[], forceAddToChannel?: boolean) => {
        if (!runID || !userIDs || userIDs?.length === 0) {
            return;
        }
        const updated = await addRunParticipants(runID, userIDs, forceAddToChannel || false);
        dispatch(playbookRunUpdated(updated));
        refreshLHS();
    }, [dispatch, refreshLHS, runID]);

    const removeFromRun = useCallback(async (userIDs?: string[]) => {
        if (!runID || !userIDs || userIDs?.length === 0) {
            return;
        }
        const updated = await removeRunParticipants(runID, userIDs);
        dispatch(playbookRunUpdated(updated));
        refreshLHS();
    }, [dispatch, refreshLHS, runID]);

    const changeRunOwner = useCallback(async (ownerID?: string) => {
        if (!runID || !ownerID) {
            return;
        }

        // Errors from setOwner propagate as a rejected Promise; callers must handle them.
        await setOwner(runID, ownerID);
        refreshLHS();
    }, [refreshLHS, runID]);

    return {addToRun, removeFromRun, changeRunOwner};
};

export const useUpdateRunItemTaskActions = (runID?: string) => {
    const updateRunTaskActions = useCallback(async (checklistNum: number, itemNum: number, taskActions: TaskAction[]) => {
        if (!runID) {
            return;
        }
        await setChecklistItemTaskActions(runID, checklistNum, itemNum, taskActions);
    }, [runID]);

    return {updateRunTaskActions};
};

/**
 * Hook to fetch a single property field for a playbook via REST.
 * @returns Tuple of [data, status] where data is the property field or undefined
 */
export const usePlaybookProperty = (
    playbookID: string,
    propertyID: string
): [PlaybookPropertyField, {loading: boolean; error?: Error}] => {
    const [field, setField] = useState<PropertyField | undefined>();
    const [loading, setLoading] = useState(Boolean(playbookID && propertyID));
    const [error, setError] = useState<Error | undefined>();

    useEffect(() => {
        let cancelled = false;
        if (!playbookID || !propertyID) {
            setField(undefined);
            setLoading(false);
            setError(undefined);
            return undefined;
        }

        setLoading(true);
        setError(undefined);
        fetchPlaybookPropertyField(playbookID, propertyID)
            .then((result) => {
                if (cancelled) {
                    return;
                }
                if (result) {
                    setField(result);
                } else {
                    setField(undefined);
                    setError(new Error('Property field not found'));
                }
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }
                setField(undefined);
                setError(err instanceof Error ? err : new Error(String(err)));
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [playbookID, propertyID]);

    return [field, {loading, error}];
};

export const useSetRunPropertyValue = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | undefined>();

    const setRunPropertyValue = useCallback(async (runID: string, propertyFieldID: string, value: unknown) => {
        setLoading(true);
        setError(undefined);
        try {
            const data = await setRunPropertyValueRequest(runID, propertyFieldID, value);
            setLoading(false);
            return {data, errors: undefined as undefined};
        } catch (err) {
            const nextError = err instanceof Error ? err : new Error(String(err));
            setError(nextError);
            setLoading(false);
            return {data: undefined, errors: [nextError]};
        }
    }, []);

    return [setRunPropertyValue, {loading, error}] as const;
};
