// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {fetchPlaybookRuns} from 'src/client';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';

import {useRunsList} from 'src/hooks';
import {PlaybookRunStatus} from 'src/types/playbook_run';

import RunList from './runs_list/runs_list';
import NoContentPage from './runs_page_no_content';

const defaultPlaybookFetchParams = {
    page: 0,
    per_page: BACKSTAGE_LIST_PER_PAGE,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: [PlaybookRunStatus.InProgress],
};

const RunsPage = () => {
    const [playbookRuns, totalCount, fetchParams, setFetchParams] = useRunsList(defaultPlaybookFetchParams);
    const [showNoPlaybookRuns, setShowNoPlaybookRuns] = useState(false);

    // When the component is first mounted, determine if there are any
    // playbook runs at all, ignoring filters. Decide once if we should show the "no playbook runs"
    // landing page.
    useEffect(() => {
        async function checkForPlaybookRuns() {
            const playbookRunsReturn = await fetchPlaybookRuns({
                page: 0,
                per_page: 1,
            });

            if (playbookRunsReturn.items.length === 0) {
                setShowNoPlaybookRuns(true);
            }
        }

        checkForPlaybookRuns();
    }, []);

    if (showNoPlaybookRuns) {
        return <NoContentPage/>;
    }

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
