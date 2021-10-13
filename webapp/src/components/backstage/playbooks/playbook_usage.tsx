// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {useEffect, useState, ReactNode} from 'react';

import {fetchPlaybookStats} from 'src/client';
import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {EmptyPlaybookStats} from 'src/types/stats';
import StatsView from 'src/components/backstage/playbooks/stats_view';
import {useRunsList} from 'src/hooks';
import RunList from '../runs_list/runs_list';
import {PlaybookRunStatus} from 'src/types/playbook_run';

const defaultPlaybookFetchParams = {
    page: 0,
    per_page: BACKSTAGE_LIST_PER_PAGE,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: [PlaybookRunStatus.InProgress],
};

const RunListContainer = styled.div`
    && {
        margin-top: 48px;
    }
`;

interface Props {
    playbook: PlaybookWithChecklist;
}

const PlaybookUsage = (props: Props) => {
    const [filterPill, setFilterPill] = useState<ReactNode>(null);
    const [stats, setStats] = useState(EmptyPlaybookStats);
    const [playbookRuns, totalCount, fetchParams, setFetchParams] = useRunsList(defaultPlaybookFetchParams);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const ret = await fetchPlaybookStats(props.playbook.id);
                setStats(ret);
            } catch {
                // Ignore any errors here. If it fails, it's most likely also failed to fetch
                // the playbook above.
            }
        };

        setFetchParams((oldParams) => {
            return {...oldParams, playbook_id: props.playbook.id};
        });

        fetchStats();
    }, [props.playbook.id, setFetchParams]);

    return (
        <OuterContainer>
            <InnerContainer>
                <StatsView
                    stats={stats}
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
                    />
                </RunListContainer>
            </InnerContainer>
        </OuterContainer>
    );
};

const OuterContainer = styled.div`
    background: var(center-channel-bg);
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

export default PlaybookUsage;
