// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';

import {
    QueryResult,
    useApolloClient,
    useMutation,
    useQuery,
} from '@apollo/client';

import {
    PlaybookDocument,
    PlaybookPropertyDocument,
    PlaybookPropertyQuery,
    PlaybookPropertyQueryVariables,
    PlaybookQuery,
    PlaybookUpdates,
    RhsRunsDocument,
    SetRunPropertyValueDocument,
    SetRunPropertyValueMutation,
    SetRunPropertyValueMutationVariables,
    UpdatePlaybookDocument,
} from 'src/graphql/generated/graphql';

import {playbookRunUpdated} from 'src/actions';
import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';
import {
    RunUpdateFields,
    addPlaybookMember,
    addRunParticipants,
    autoFollowPlaybook,
    removePlaybookMember,
    removeRunParticipants,
    setChecklistItemTaskActions,
    setOwner,
    setPlaybookFavorite,
    setRunFavorite,
    updatePlaybookRun,
} from 'src/client';
import {useAppDispatch} from 'src/hooks/redux';
import {TaskAction} from 'src/types/playbook';

export type FullPlaybook = PlaybookQuery['playbook']

export type PlaybookPropertyField = PlaybookPropertyQuery['playbookProperty']

export type Loaded<T> = Exclude<T, undefined | null>

export const usePlaybook = (id: string): [FullPlaybook, QueryResult<PlaybookQuery, {id: string}>] => {
    const result = useQuery(PlaybookDocument, {
        variables: {
            id,
        },
        fetchPolicy: 'network-only',
        nextFetchPolicy: 'cache-first',
    });

    let playbook : FullPlaybook = result.data?.playbook;
    playbook = playbook === null ? undefined : playbook;

    return [playbook, result];
};

export const useUpdatePlaybook = (id?: string) => {
    const [innerUpdatePlaybook] = useMutation(UpdatePlaybookDocument, {
        refetchQueries: [
            PlaybookDocument,
        ],
    });
    return useCallback((updates: PlaybookUpdates) => {
        return innerUpdatePlaybook({variables: {id: id || '', updates}});
    }, [id, innerUpdatePlaybook]);
};

export const useUpdatePlaybookFavorite = (id: string|undefined) => {
    const refreshLHS = useLHSRefresh();
    const apolloClient = useApolloClient();

    return useCallback(async (favorite: boolean) => {
        if (id === undefined) {
            return;
        }
        await setPlaybookFavorite(id, favorite);
        refreshLHS();

        // Keep Apollo playbook query in sync until usePlaybook moves to REST.
        await apolloClient.refetchQueries({
            include: [PlaybookDocument],
        });
    }, [apolloClient, id, refreshLHS]);
};

export const useUpdateRun = (id?: string) => {
    const dispatch = useAppDispatch();
    const refreshLHS = useLHSRefresh();
    const apolloClient = useApolloClient();

    return useCallback(async (updates: RunUpdateFields) => {
        if (!id) {
            return;
        }
        const updated = await updatePlaybookRun(id, updates);
        dispatch(playbookRunUpdated(updated));
        refreshLHS();

        // Keep Apollo RHS runs list in sync until that query moves to REST.
        await apolloClient.refetchQueries({
            include: [RhsRunsDocument],
        });
    }, [apolloClient, dispatch, id, refreshLHS]);
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
        await autoFollowPlaybook(playbookID, userID);
        refreshLHS();
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
 * Hook to fetch a single property field for a playbook
 * @param playbookID - The ID of the playbook
 * @param propertyID - The ID of the property field
 * @returns Tuple of [data, queryResult] where data is the property field or undefined
 */
export const usePlaybookProperty = (
    playbookID: string,
    propertyID: string
): [PlaybookPropertyField, QueryResult<PlaybookPropertyQuery, PlaybookPropertyQueryVariables>] => {
    const result = useQuery(PlaybookPropertyDocument, {
        variables: {
            playbookID,
            propertyID,
        },
        fetchPolicy: 'cache-first',
        errorPolicy: 'all', // Allow partial data and errors to be returned
    });

    return [result.data?.playbookProperty ?? undefined, result] as const;
};

export const useSetRunPropertyValue = () => {
    const [innerSetRunPropertyValue, result] = useMutation<
        SetRunPropertyValueMutation,
        SetRunPropertyValueMutationVariables
    >(SetRunPropertyValueDocument, {
        errorPolicy: 'all',
    });

    const setRunPropertyValue = useCallback(
        (runID: string, propertyFieldID: string, value: any) => {
            return innerSetRunPropertyValue({
                variables: {
                    runID,
                    propertyFieldID,
                    value,
                },
            });
        },
        [innerSetRunPropertyValue]
    );

    return [setRunPropertyValue, result] as const;
};
