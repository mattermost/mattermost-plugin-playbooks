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
    playbook = playbook === null ? undefined : playbook; //eslint-disable-line no-undefined

    return [playbook, result];
};

export const useUpdatePlaybook = (id?: string) => {
    const result = useUpdatePlaybookMutation({
        refetchQueries: [
            PlaybookDocument,
        ],
    });
    const updatePlaybook = (updates: PlaybookUpdates) => {
        const [innerUpdatePlaybook] = result;
        return innerUpdatePlaybook({variables: {id: id || '', updates}});
    };
    return updatePlaybook;
};
