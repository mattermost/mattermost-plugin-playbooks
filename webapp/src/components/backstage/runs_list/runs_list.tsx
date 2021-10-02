// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

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
    filterPill: React.ReactNode
    fixedTeam?: boolean
}

const PlaybookRunList = styled.div`
    font-family: 'Open Sans';
    color: var(--center-channel-color-90);

    .PlaybookRunList__filters {
        display: flex;
        align-items: center;
        margin: 0 -4px 20px;

        > div {
            padding: 0 4px;
        }
    }
`;

const List = styled.div`
    .playbook-run-item {
        display: flex;
        padding-top: 8px;
        padding-bottom: 8px;
        align-items: center;
        margin: 0;
        border-bottom: 1px solid var(--center-channel-color-16);
        cursor: pointer;

        &:hover {
            background: var(--center-channel-color-04);
        }

        &__title {
            display: flex;
            flex-direction: column;

            > span {
                font-weight: 600;
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow: hidden;
            }
        }
    }
`;

const RunList = ({playbookRuns, totalCount, fetchParams, setFetchParams, filterPill, fixedTeam}: Props) => {
    const isFiltering = (
        (fetchParams?.search_term?.length ?? 0) > 0 ||
        (fetchParams?.statuses?.length ?? 0) > 1 ||
        (fetchParams?.owner_user_id?.length ?? 0) > 0 ||
        (fetchParams?.participant_id?.length ?? 0) > 0
    );

    const setPage = (page: number) => {
        setFetchParams({...fetchParams, page});
    };

    return (
        <PlaybookRunList className='PlaybookRunList'>
            <List
                id='playbookRunList'
                className='list'
            >
                <Filters
                    fetchParams={fetchParams}
                    setFetchParams={setFetchParams}
                    fixedTeam={fixedTeam}
                />
                {filterPill}
                <RunListHeader
                    fetchParams={fetchParams}
                    setFetchParams={setFetchParams}
                />
                {playbookRuns.length === 0 && !isFiltering &&
                <div className='text-center pt-8'>
                    {'There are no runs for this playbook.'}
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
            </List>
        </PlaybookRunList>
    );
};

export default RunList;
