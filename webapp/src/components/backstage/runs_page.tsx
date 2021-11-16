// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {FormattedMessage} from 'react-intl';

import styled from 'styled-components';

import {fetchPlaybookRuns} from 'src/client';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';

import {useRunsList} from 'src/hooks';
import {BackstageHeader} from 'src/components/backstage/styles';

import RunList from './runs_list/runs_list';
import {statusOptions} from './runs_list/status_filter';
import NoContentPage from './runs_page_no_content';

const defaultPlaybookFetchParams = {
    page: 0,
    per_page: BACKSTAGE_LIST_PER_PAGE,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: statusOptions
        .filter((opt) => opt.value !== 'Finished' && opt.value !== '')
        .map((opt) => opt.value),
};

const RunListContainer = styled.div`
	margin: 0 auto;
	max-width: 1160px;
	padding: 0 20px;
`;

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
        <RunListContainer>
            <BackstageHeader data-testid='titlePlaybookRun'>
                <FormattedMessage defaultMessage='Runs'/>
            </BackstageHeader>
            <RunList
                playbookRuns={playbookRuns}
                totalCount={totalCount}
                fetchParams={fetchParams}
                setFetchParams={setFetchParams}
                filterPill={null}
            />
        </RunListContainer>
    );
};

export default RunsPage;
