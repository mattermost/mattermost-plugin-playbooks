// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';

import {QueryResult, useMutation, useQuery} from '@apollo/client';

import {
    AddPlaybookMemberDocument,
    AddPlaybookPropertyFieldDocument,
    AddPlaybookPropertyFieldMutation,
    AddPlaybookPropertyFieldMutationVariables,
    AddRunParticipantsDocument,
    ChangeRunOwnerDocument,
    DeletePlaybookPropertyFieldDocument,
    DeletePlaybookPropertyFieldMutation,
    DeletePlaybookPropertyFieldMutationVariables,
    PlaybookDocument,
    PlaybookLhsDocument,
    PlaybookPropertyDocument,
    PlaybookPropertyQuery,
    PlaybookPropertyQueryVariables,
    PlaybookQuery,
    PlaybookUpdates,
    PropertyFieldInput,
    RemovePlaybookMemberDocument,
    RemoveRunParticipantsDocument,
    RhsRunsDocument,
    RunUpdates,
    SetRunFavoriteDocument,
    SetRunPropertyValueDocument,
    SetRunPropertyValueMutation,
    SetRunPropertyValueMutationVariables,
    TaskActionUpdates,
    UpdatePlaybookDocument,
    UpdatePlaybookFavoriteDocument,
    UpdatePlaybookPropertyFieldDocument,
    UpdatePlaybookPropertyFieldMutation,
    UpdatePlaybookPropertyFieldMutationVariables,
    UpdateRunDocument,
    UpdateRunTaskActionsDocument,
} from 'src/graphql/generated/graphql';

import {autoFollowPlaybook} from 'src/client';

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
    const [innerUpdatePlaybook] = useMutation(UpdatePlaybookFavoriteDocument, {
        refetchQueries: [
            PlaybookLhsDocument,
            PlaybookDocument,
        ],
    });

    return useCallback((favorite: boolean) => {
        if (id === undefined) {
            return;
        }
        innerUpdatePlaybook({variables: {id, favorite}});
    }, [id, innerUpdatePlaybook]);
};

export const useUpdateRun = (id?: string) => {
    const [innerUpdateRun] = useMutation(UpdateRunDocument, {
        refetchQueries: [
            PlaybookLhsDocument,
            RhsRunsDocument,
        ],
    });

    return useCallback((updates: RunUpdates) => {
        return innerUpdateRun({variables: {id: id || '', updates}});
    }, [id, innerUpdateRun]);
};

export const useSetRunFavorite = (id: string|undefined) => {
    const [innerUpdateRun] = useMutation(SetRunFavoriteDocument, {
        refetchQueries: [
            PlaybookLhsDocument,
        ],
    });

    return useCallback((fav: boolean) => {
        if (id === undefined) {
            return;
        }
        innerUpdateRun({variables: {id, fav}});
    }, [id, innerUpdateRun]);
};

export const usePlaybookMembership = (playbookID?: string, userID?: string) => {
    const [joinPlaybook] = useMutation(AddPlaybookMemberDocument, {
        refetchQueries: [
            PlaybookLhsDocument,
        ],
        variables: {
            playbookID: playbookID || '',
            userID: userID || '',
        },
    });

    const [leavePlaybook] = useMutation(RemovePlaybookMemberDocument, {
        refetchQueries: [
            PlaybookLhsDocument,
        ],
        variables: {
            playbookID: playbookID || '',
            userID: userID || '',
        },
    });

    const join = useCallback(async () => {
        if (!playbookID || !userID) {
            return;
        }
        await joinPlaybook();
        await autoFollowPlaybook(playbookID, userID);
    }, [playbookID, userID, joinPlaybook]);

    const leave = useCallback(async () => {
        if (!playbookID || !userID) {
            return;
        }
        await leavePlaybook();
    }, [playbookID, userID, leavePlaybook]);

    return {join, leave};
};

export const useManageRunMembership = (runID?: string) => {
    const [add] = useMutation(AddRunParticipantsDocument, {
        refetchQueries: [
            PlaybookLhsDocument,
        ],
    });

    const [remove] = useMutation(RemoveRunParticipantsDocument, {
        refetchQueries: [
            PlaybookLhsDocument,
        ],
    });

    const [changeOwner] = useMutation(ChangeRunOwnerDocument, {
        refetchQueries: [
        ],
    });

    const addToRun = useCallback(async (userIDs?: string[], forceAddToChannel?: boolean) => {
        if (!runID || !userIDs || userIDs?.length === 0) {
            return;
        }
        await add({variables: {runID: runID || '', userIDs: userIDs || [], forceAddToChannel: forceAddToChannel || false}});
    }, [runID, add]);

    const removeFromRun = useCallback(async (userIDs?: string[]) => {
        if (!runID || !userIDs || userIDs?.length === 0) {
            return;
        }
        await remove({variables: {runID: runID || '', userIDs: userIDs || []}});
    }, [runID, remove]);

    const changeRunOwner = useCallback(async (ownerID?: string) => {
        if (!runID || !ownerID) {
            return;
        }
        await changeOwner({variables: {runID: runID || '', ownerID: ownerID || ''}});
    }, [runID, changeOwner]);

    return {addToRun, removeFromRun, changeRunOwner};
};

export const useUpdateRunItemTaskActions = (runID?: string) => {
    const [updateTaskActions] = useMutation(UpdateRunTaskActionsDocument, {
        refetchQueries: [
        ],
    });

    const updateRunTaskActions = useCallback(async (checklistNum: number, itemNum: number, taskActions: TaskActionUpdates[]) => {
        if (!runID) {
            return;
        }
        await updateTaskActions({variables: {runID, checklistNum, itemNum, taskActions}});
    }, [runID, updateTaskActions]);

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

/**
 * Hook to add a new property field to a playbook
 * @returns Tuple of [mutationFunction, mutationResult]
 */
export const useAddPlaybookPropertyField = () => {
    const [innerAddPropertyField, result] = useMutation<
        AddPlaybookPropertyFieldMutation,
        AddPlaybookPropertyFieldMutationVariables
    >(AddPlaybookPropertyFieldDocument, {
        errorPolicy: 'all',
        refetchQueries: [PlaybookDocument, PlaybookLhsDocument],
    });

    const addPropertyField = useCallback(
        (playbookID: string, propertyField: PropertyFieldInput) => {
            return innerAddPropertyField({
                variables: {
                    playbookID,
                    propertyField,
                },
            });
        },
        [innerAddPropertyField]
    );

    return [addPropertyField, result] as const;
};

/**
 * Hook to update an existing property field in a playbook
 * @returns Tuple of [mutationFunction, mutationResult]
 */
export const useUpdatePlaybookPropertyField = () => {
    const [innerUpdatePropertyField, result] = useMutation<
        UpdatePlaybookPropertyFieldMutation,
        UpdatePlaybookPropertyFieldMutationVariables
    >(UpdatePlaybookPropertyFieldDocument, {
        errorPolicy: 'all',
        refetchQueries: [PlaybookDocument, PlaybookLhsDocument],
    });

    const updatePropertyField = useCallback(
        (playbookID: string, propertyFieldID: string, propertyField: PropertyFieldInput) => {
            return innerUpdatePropertyField({
                variables: {
                    playbookID,
                    propertyFieldID,
                    propertyField,
                },
            });
        },
        [innerUpdatePropertyField]
    );

    return [updatePropertyField, result] as const;
};

/**
 * Hook to delete a property field from a playbook
 * @returns Tuple of [mutationFunction, mutationResult]
 */
export const useDeletePlaybookPropertyField = () => {
    const [innerDeletePropertyField, result] = useMutation<
        DeletePlaybookPropertyFieldMutation,
        DeletePlaybookPropertyFieldMutationVariables
    >(DeletePlaybookPropertyFieldDocument, {
        errorPolicy: 'all',
        refetchQueries: [PlaybookDocument, PlaybookLhsDocument],
    });

    const deletePropertyField = useCallback(
        (playbookID: string, propertyFieldID: string) => {
            return innerDeletePropertyField({
                variables: {
                    playbookID,
                    propertyFieldID,
                },
            });
        },
        [innerDeletePropertyField]
    );

    return [deletePropertyField, result] as const;
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
