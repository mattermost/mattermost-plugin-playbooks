// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {useEffect, useState, ReactNode} from 'react';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {PlaybookStats} from 'src/types/stats';
import StatsView from 'src/components/backstage/playbooks/stats_view';
import {useRunsList} from 'src/hooks';
import RunList from '../runs_list/runs_list';
import {PlaybookRunStatus} from 'src/types/playbook_run';

const defaultPlaybookFetchParams = {
    page: 0,
    per_page: BACKSTAGE_LIST_PER_PAGE,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: [PlaybookRunStatus.InProgress, PlaybookRunStatus.Finished],
};

interface Props {
    playbookID: string;
    stats: PlaybookStats;
}

const PlaybookUsage = (props: Props) => {
    const [filterPill, setFilterPill] = useState<ReactNode>(null);
    const [playbookRuns, totalCount, fetchParams, setFetchParams] = useRunsList(defaultPlaybookFetchParams);

    useEffect(() => {
        setFetchParams((oldParams) => {
            return {...oldParams, playbook_id: props.playbookID, page: 0};
        });
    }, [props.playbookID, setFetchParams]);

    return (
        <OuterContainer>
            <InnerContainer>
                <StatsView
                    stats={props.stats}
                    fetchParams={fetchParams}
                    setFetchParams={setFetchParams}
                    setFilterPill={setFilterPill}
                />
                <RunListContainer>
                    <RunList
                        playbookRuns={playbookRuns}
                        totalCount={totalCount}
                        fetchParams={fetchParams}
                        setFetchParams={setFetchParams}
                        filterPill={filterPill}
                        fixedTeam={true}
                        fixedPlaybook={true}
                    />
                </RunListContainer>
            </InnerContainer>
        </OuterContainer>
    );
};

const OuterContainer = styled.div`
    height: 100%;
`;

const InnerContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 20px;
    max-width: 1120px;
    margin: 0 auto;
    font-family: 'Open Sans', sans-serif;
    font-style: normal;
    font-weight: 600;

    > div + div {
        margin-top: 16px;
    }
`;

const RunListContainer = styled.div`
    && {
        margin-top: 48px;
    }
`;

export default PlaybookUsage;
