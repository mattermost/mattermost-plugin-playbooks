import {useCallback} from 'react';

import {autoFollowPlaybook} from 'src/client';

import {
    PlaybookDocument,
    PlaybookLhsDocument,
    PlaybookQuery,
    PlaybookQueryHookResult,
    PlaybookUpdates,
    RunDocument,
    RunUpdates,
    useAddPlaybookMemberMutation,
    useAddRunParticipantsMutation,
    useChangeRunOwnerMutation,
    usePlaybookQuery,
    useRemovePlaybookMemberMutation,
    useRemoveRunParticipantsMutation,
    useUpdatePlaybookMutation,
    useUpdateRunMutation,
} from 'src/graphql/generated_types';

export type FullPlaybook = PlaybookQuery['playbook']

export type Loaded<T> = Exclude<T, undefined | null>

export const usePlaybook = (id: string): [FullPlaybook, PlaybookQueryHookResult] => {
    const result = usePlaybookQuery({
        variables: {
            id,
        },
        fetchPolicy: 'network-only',
        nextFetchPolicy: 'cache-first',
    });

    let playbook = result.data?.playbook;
    playbook = playbook === null ? undefined : playbook;

    return [playbook, result];
};

export const useUpdatePlaybook = (id?: string) => {
    const [innerUpdatePlaybook] = useUpdatePlaybookMutation({
        refetchQueries: [
            PlaybookDocument,
        ],
    });
    return useCallback((updates: PlaybookUpdates) => {
        return innerUpdatePlaybook({variables: {id: id || '', updates}});
    }, [id, innerUpdatePlaybook]);
};

export const useUpdateRun = (id?: string) => {
    const [innerUpdateRun] = useUpdateRunMutation({
        refetchQueries: [
            PlaybookLhsDocument,
        ],
    });

    return useCallback((updates: RunUpdates) => {
        return innerUpdateRun({variables: {id: id || '', updates}});
    }, [id, innerUpdateRun]);
};

export const usePlaybookMembership = (playbookID?: string, userID?: string) => {
    const [joinPlaybook] = useAddPlaybookMemberMutation({
        refetchQueries: [
            PlaybookLhsDocument,
        ],
        variables: {
            playbookID: playbookID || '',
            userID: userID || '',
        },
    });

    const [leavePlaybook] = useRemovePlaybookMemberMutation({
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

export const useRunMembership = (runID?: string, userIDs?: string[]) => {
    const [add] = useAddRunParticipantsMutation({
        refetchQueries: [
            PlaybookLhsDocument,
        ],
        variables: {
            runID: runID || '',
            userIDs: userIDs || [],
        },
    });

    const [remove] = useRemoveRunParticipantsMutation({
        refetchQueries: [
            PlaybookLhsDocument,
        ],
        variables: {
            runID: runID || '',
            userIDs: userIDs || [],
        },
    });

    const addToRun = useCallback(async () => {
        if (!runID || !userIDs || userIDs?.length === 0) {
            return;
        }
        await add();
    }, [runID, JSON.stringify(userIDs), add]);

    const removeFromRun = useCallback(async () => {
        if (!runID || !userIDs || userIDs?.length === 0) {
            return;
        }
        await remove();
    }, [runID, JSON.stringify(userIDs), remove]);
    return {addToRun, removeFromRun};
};

export const useManageRunMembership = (runID?: string) => {
    const [add] = useAddRunParticipantsMutation({
        refetchQueries: [
            RunDocument,
        ],
    });

    const [remove] = useRemoveRunParticipantsMutation({
        refetchQueries: [
            RunDocument,
        ],
    });

    const [changeOwner] = useChangeRunOwnerMutation({
        refetchQueries: [
            RunDocument,
        ],
    });

    const addToRun = useCallback(async (userIDs?: string[]) => {
        if (!runID || !userIDs || userIDs?.length === 0) {
            return;
        }
        await add({variables: {runID: runID || '', userIDs: userIDs || []}});
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
