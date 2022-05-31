import {useCallback} from 'react';

import {PlaybookDocument, PlaybookQuery, PlaybookQueryHookResult, PlaybookUpdates, usePlaybookQuery, useUpdatePlaybookMutation} from 'src/graphql/generated_types';

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
