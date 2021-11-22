// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import {FormattedMessage} from 'react-intl';

import {FetchPlaybookRunsParams, PlaybookRun} from 'src/types/playbook_run';

import PaginationRow from './pagination_row';
import Row from './row';
import RunListHeader from './run_list_header';
import Filters from './filters';

interface Props {
    playbookRuns: PlaybookRun[]
    totalCount: number
    fetchParams: FetchPlaybookRunsParams
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>
    filterPill: React.ReactNode | null
    fixedTeam?: boolean
    fixedPlaybook?: boolean
}

const PlaybookRunList = styled.div`
    font-family: 'Open Sans', sans-serif;
    color: var(--center-channel-color-90);
`;

const RunList = ({playbookRuns, totalCount, fetchParams, setFetchParams, filterPill, fixedTeam, fixedPlaybook}: Props) => {
    const isFiltering = (
        (fetchParams?.search_term?.length ?? 0) > 0 ||
        (fetchParams?.statuses?.length ?? 0) > 1 ||
        (fetchParams?.owner_user_id?.length ?? 0) > 0 ||
        (fetchParams?.participant_id?.length ?? 0) > 0 ||
        (fetchParams?.participant_or_follower_id?.length ?? 0) > 0
    );

    const setPage = (page: number) => {
        setFetchParams({...fetchParams, page});
    };

    return (
        <PlaybookRunList className='PlaybookRunList'>
            <div
                id='playbookRunList'
                className='list'
            >
                <Filters
                    fetchParams={fetchParams}
                    setFetchParams={setFetchParams}
                    fixedTeam={fixedTeam}
                    fixedPlaybook={fixedPlaybook}
                />
                {filterPill}
                <RunListHeader
                    fetchParams={fetchParams}
                    setFetchParams={setFetchParams}
                />
                {playbookRuns.length === 0 && !isFiltering &&
                <div className='text-center pt-8'>
                    <FormattedMessage defaultMessage='There are no runs for this playbook.'/>
                </div>
                }
                {playbookRuns.length === 0 && isFiltering &&
                <div className='text-center pt-8'>
                    {'There are no runs matching those filters.'}
                </div>
                }
                {playbookRuns.map((playbookRun) => (
                    <Row
                        key={playbookRun.id}
                        playbookRun={playbookRun}
                        fixedTeam={fixedTeam}
                    />
                ))}
                <PaginationRow
                    page={fetchParams.page}
                    perPage={fetchParams.per_page}
                    totalCount={totalCount}
                    setPage={setPage}
                />
            </div>
        </PlaybookRunList>
    );
};

export default RunList;
