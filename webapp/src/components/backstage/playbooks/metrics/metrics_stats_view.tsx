// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import MetricsCard from 'src/components/backstage/playbooks/metrics/metrics_card';
import {DevMetrics, PlaybookStats} from 'src/types/stats';
import {Metric, MetricType, PlaybookWithChecklist} from 'src/types/playbook';
import {ClockOutline, DollarSign, PoundSign} from 'src/components/backstage/playbook_edit/styles';

interface Props {
    playbook: PlaybookWithChecklist;
    stats: PlaybookStats;
}

const MetricsStatsView = ({playbook, stats}: Props) => {
    return (
        <>
            {
                playbook.metrics.map((metric, idx) => (
                    <>
                        <MetricHeader
                            key={idx}
                            metric={metric}
                        />
                        <MetricsCard
                            playbook={playbook}

                            // TODO: for development only; replace {...stats, ...metrics} with stats
                            playbookStats={{...stats, ...DevMetrics}}
                            index={idx}
                        />
                    </>
                ))
            }
        </>
    );
};

const MetricHeader = ({metric}: { metric: Metric }) => {
    let icon = <DollarSign sizePx={18}/>;
    if (metric.type === MetricType.Integer) {
        icon = <PoundSign sizePx={18}/>;
    } else if (metric.type === MetricType.Duration) {
        icon = <ClockOutline sizePx={18}/>;
    }

    return (
        <Header>
            <Icon>{icon}</Icon>
            <Title>{metric.title}</Title>
            <HorizontalLine/>
        </Header>
    );
};

const Header = styled.div`
    display: flex;
    align-items: center;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: var(--center-channel-color);

    svg {
        color: rgba(var(--center-channel-color-rgb), 0.56);
        margin-right: 7px;
    }
`;

const Icon = styled.div`
    margin-bottom: -6px;
`;

const Title = styled.div`
    white-space: nowrap;
`;

const HorizontalLine = styled.div`
    height: 0;
    width: 100%;
    margin: 0 0 0 16px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

export default MetricsStatsView;
