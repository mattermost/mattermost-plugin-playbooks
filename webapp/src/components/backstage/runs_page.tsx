// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';

import {useRunsList} from 'src/hooks';

import RunList from './runs_list/runs_list';
import {StatusOption} from './runs_list/status_filter';

//TODO Unify these.
const statusOptions: StatusOption[] = [
    {value: '', label: 'All'},
    {value: 'InProgress', label: 'In Progress'},
    {value: 'Finished', label: 'Finished'},
];

const defaultPlaybookFetchParams = {
    page: 0,
    per_page: BACKSTAGE_LIST_PER_PAGE,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: statusOptions
        .filter((opt) => opt.value !== 'Finished' && opt.value !== '')
        .map((opt) => opt.value),
};

const RunsPage = () => {
    const [playbookRuns, totalCount, fetchParams, setFetchParams] = useRunsList(defaultPlaybookFetchParams);

    return (
        <div className='PlaybookRunList container-medium'>
            <div className='Backstage__header'>
                <div
                    className='title'
                    data-testid='titlePlaybookRun'
                >
                    {'Runs'}
                </div>
            </div>
            <RunList
                playbookRuns={playbookRuns}
                totalCount={totalCount}
                fetchParams={fetchParams}
                setFetchParams={setFetchParams}
                filterPill={null}
            />
        </div>
    );
};

export default RunsPage;
