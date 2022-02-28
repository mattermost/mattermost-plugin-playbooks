// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import styled from 'styled-components';

import {PlaybookWithChecklist} from 'src/types/playbook';
import {PlaybookStats} from 'src/types/stats';
import {useAllowPlaybookAndRunMetrics, useRunsList} from 'src/hooks';
import UpgradeKeyMetricsPlaceholder from 'src/components/backstage/playbooks/metrics/upgrade_key_metrics_placeholder';
import MetricsStatsView from 'src/components/backstage/playbooks/metrics/metrics_stats_view';
import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {PlaybookRunStatus} from 'src/types/playbook_run';
import MetricsRunList from 'src/components/backstage/playbooks/metrics/metrics_run_list';
import NoMetricsPlaceholder from 'src/components/backstage/playbooks/metrics/no_metrics_placeholder';

const defaultPlaybookFetchParams = {
    page: 0,
    per_page: BACKSTAGE_LIST_PER_PAGE,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: [PlaybookRunStatus.Finished],
};

interface Props {
    playbook: PlaybookWithChecklist;
    stats: PlaybookStats;
}

const PlaybookKeyMetrics = ({playbook, stats}: Props) => {
    const allowStatsView = useAllowPlaybookAndRunMetrics();
    const [playbookRuns, totalCount, fetchParams, setFetchParams] = useRunsList(defaultPlaybookFetchParams);

    useEffect(() => {
        setFetchParams((oldParams) => {
            return {...oldParams, playbook_id: playbook.id};
        });
    }, [playbook.id, setFetchParams]);

    if (!allowStatsView) {
        return (
            <OuterContainer>
                <InnerContainer>
                    <PlaceholderRow>
                        <UpgradeKeyMetricsPlaceholder/>
                    </PlaceholderRow>
                </InnerContainer>
            </OuterContainer>
        );
    }

    if (playbook.metrics.length === 0) {
        return (
            <OuterContainer>
                <InnerContainer>
                    <NoMetricsPlaceholder/>
                </InnerContainer>
            </OuterContainer>
        );
    }

    return (
        <OuterContainer>
            <InnerContainer>
                <MetricsStatsView
                    playbook={playbook}
                    stats={stats}
                />
                <RunListContainer>
                    <MetricsRunList
                        playbook={playbook}
                        playbookRuns={playbookRuns}
                        totalCount={totalCount}
                        fetchParams={fetchParams}
                        setFetchParams={setFetchParams}
                    />
                </RunListContainer>
            </InnerContainer>
        </OuterContainer>
    );
};

const PlaceholderRow = styled.div`
    height: 260px;
    margin: 32px 0;
`;

const OuterContainer = styled.div`
    height: 100%;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
`;

const InnerContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 0 20px 20px;
    max-width: 1120px;
    margin: 0 auto;
    font-family: 'Open Sans', sans-serif;
    font-style: normal;
    font-weight: 600;
`;

const RunListContainer = styled.div`
    && {
        margin-top: 36px;
    }
`;

export default PlaybookKeyMetrics;
