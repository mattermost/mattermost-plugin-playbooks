import {useCallback} from 'react';

import {autoFollowPlaybook} from 'src/client';

import {
    PlaybookDocument,
    PlaybookLhsDocument,
    RunDocument,
    PlaybookQuery,
    RunQuery,
    PlaybookQueryHookResult,
    RunQueryHookResult,
    PlaybookUpdates,
    RunUpdates,
    useAddPlaybookMemberMutation,
    useAddRunParticipantsMutation,
    usePlaybookQuery,
    useRunQuery,
    useRemovePlaybookMemberMutation,
    useRemoveRunParticipantsMutation,
    useUpdatePlaybookMutation,
    useUpdateRunMutation,
    usePostRunStatusUpdateMutation,
    RunStatusPostUpdate,
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
            RunDocument,
        ],
    });

    return useCallback((updates: RunUpdates) => {
        return innerUpdateRun({variables: {id: id || '', updates}});
    }, [id, innerUpdateRun]);
};

export const useRunPostStatusUpdate = (id?: string) => {
    const [innerPostUpdate] = usePostRunStatusUpdateMutation({
        refetchQueries: [RunDocument],
    });

    return useCallback((update: RunStatusPostUpdate) => {
        return innerPostUpdate({variables: {runID: id || '', update}});
    }, [id, innerPostUpdate]);
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

export type FullRun = NonNullable<RunQuery['run']>
export const useRun = (id: string): [RunQuery['run'], RunQueryHookResult] => {
    const result = useRunQuery({
        variables: {
            id,
        },
        fetchPolicy: 'network-only',
        nextFetchPolicy: 'cache-first',
    });

    let run = result.data?.run;
    run = run === null ? undefined : run;

    return [run, result];
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

