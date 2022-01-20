import {useEffect, useState} from 'react';
import debounce from 'debounce';

import {
    archivePlaybook as clientArchivePlaybook,
    duplicatePlaybook as clientDuplicatePlaybook,
    clientFetchPlaybook,
    clientFetchPlaybooks,
    savePlaybook,
} from 'src/client';
import {FetchPlaybooksParams, Playbook, PlaybookWithChecklist} from 'src/types/playbook';

type ParamsState = Required<FetchPlaybooksParams>;

const searchDebounceDelayMilliseconds = 300;

export async function getPlaybookOrFetch(id: string, playbooks: Playbook[] | null) {
    return playbooks?.find((p) => p.id === id) ?? clientFetchPlaybook(id);
}

/**
 * Read-only logic to fetch playbook
 * @param id identifier of playbook to fetch
 * @remarks lightweight alternative to {@link usePlaybooksCrud} for read-only usage
 */
export function usePlaybook(id: Playbook['id']) {
    const [playbook, setPlaybook] = useState<PlaybookWithChecklist | undefined>();
    useEffect(() => {
        clientFetchPlaybook(id).then(setPlaybook);
    }, [id]);

    return playbook;
}

type EditPlaybookReturn = [PlaybookWithChecklist | undefined, (update: Partial<PlaybookWithChecklist>) => void]

export function useEditPlaybook(id: Playbook['id']): EditPlaybookReturn {
    const [playbook, setPlaybook] = useState<PlaybookWithChecklist | undefined>();
    useEffect(() => {
        clientFetchPlaybook(id).then(setPlaybook);
    }, [id]);

    const updatePlaybook = (update: Partial<PlaybookWithChecklist>) => {
        if (playbook) {
            const updatedPlaybook: PlaybookWithChecklist = {...playbook, ...update};
            setPlaybook(updatedPlaybook);
            savePlaybook(updatedPlaybook);
        }
    };

    return [playbook, updatePlaybook];
}

export function usePlaybooksCrud(
    defaultParams: Partial<FetchPlaybooksParams>,
    {infinitePaging} = {infinitePaging: false},
) {
    const [playbooks, setPlaybooks] = useState<Playbook[] | null>(null);
    const [isLoading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedPlaybook, setSelectedPlaybookState] = useState<Playbook | null>();
    const [params, setParamsState] = useState<ParamsState>({
        team_id: '',
        sort: 'title',
        direction: 'asc',
        page: 0,
        per_page: 10,
        search_term: '',
        ...defaultParams,
    });

    const setParams = (newParams: Partial<ParamsState>) => {
        setParamsState({...params, ...newParams});
    };

    useEffect(() => {
        fetchPlaybooks();
    }, [params]);

    const setSelectedPlaybook = async (nextSelected: Playbook | string | null) => {
        if (typeof nextSelected !== 'string') {
            return setSelectedPlaybookState(nextSelected);
        }

        if (!nextSelected) {
            return setSelectedPlaybookState(null);
        }

        return setSelectedPlaybookState(await getPlaybookOrFetch(nextSelected, playbooks) ?? null);
    };

    /**
     * Go to specific or next page
     * @param page - defaults to next page if there is one
     */
    const setPage = (page = (hasMore && params.page + 1) || 0) => {
        setParams({page});
    };

    const fetchPlaybooks = async () => {
        setLoading(true);
        const result = await clientFetchPlaybooks(params.team_id, params);
        if (result) {
            setPlaybooks(infinitePaging && playbooks ? [...playbooks, ...result.items] : result.items);
            setTotalCount(result.total_count);
            setHasMore(result.has_more);
        }
        setLoading(false);
    };

    const archivePlaybook = async (playbookId: Playbook['id']) => {
        await clientArchivePlaybook(playbookId);

        // Fetch latest count
        const result = await clientFetchPlaybooks(params.team_id, params);

        if (result) {
            // Go back to previous page if the last item on this page was just deleted
            // Setting the page here results in fetching playbooks through the params dependency of the effect above
            setPage(Math.max(Math.min(result.page_count - 1, params.page), 0));
        }
    };

    const duplicatePlaybook = async (playbookId: Playbook['id']) => {
        await clientDuplicatePlaybook(playbookId);
        await fetchPlaybooks();
    };

    const sortBy = (colName: FetchPlaybooksParams['sort']) => {
        if (params.sort === colName) {
            // we're already sorting on this column; reverse the direction
            const newSortDirection = params.direction === 'asc' ? 'desc' : 'asc';
            setParams({direction: newSortDirection});
            return;
        }

        setParams({sort: colName, direction: 'desc'});
    };

    const setSearchTerm = (term: string) => {
        setLoading(true);
        setParams({search_term: term});
    };
    const setSearchTermDebounced = debounce(setSearchTerm, searchDebounceDelayMilliseconds);

    const isFiltering = (params?.search_term?.length ?? 0) > 0;

    return [
        playbooks,
        {isLoading, totalCount, hasMore, params, selectedPlaybook},
        {
            setPage,
            setParams,
            sortBy,
            setSelectedPlaybook,
            archivePlaybook,
            duplicatePlaybook,
            setSearchTerm: setSearchTermDebounced,
            isFiltering,
        },
    ] as const;
}
