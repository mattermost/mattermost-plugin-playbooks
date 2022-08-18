import {useCallback} from 'react';

import {autoFollowPlaybook} from 'src/client';

import {
    PlaybookDocument,
    PlaybookLhsDocument,
    PlaybookQuery,
    PlaybookQueryHookResult,
    PlaybookUpdates,
    RunUpdates,
    useAddPlaybookMemberMutation,
    useAddRunParticipantsMutation,
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

export const useRunAddParticipants = (runID?: string, userIDs?: string[]) => {
    const [addToRun] = useAddRunParticipantsMutation({
        refetchQueries: [
            PlaybookLhsDocument,
        ],
        variables: {
            runID: runID || '',
            userIDs: userIDs || [],
        },
    });

    return useCallback(async () => {
        if (!runID || !userIDs || userIDs?.length === 0) {
            return;
        }
        await addToRun();
    }, [runID, JSON.stringify(userIDs), addToRun]);
};

export const useRunRemoveParticipants = (runID?: string, userIDs?: string[]) => {
    const [removeFromRun] = useRemoveRunParticipantsMutation({
        refetchQueries: [
            PlaybookLhsDocument,
        ],
        variables: {
            runID: runID || '',
            userIDs: userIDs || [],
        },
    });

    return useCallback(async () => {
        if (!runID || !userIDs || userIDs?.length === 0) {
            return;
        }
        await removeFromRun();
    }, [runID, JSON.stringify(userIDs), removeFromRun]);
};
