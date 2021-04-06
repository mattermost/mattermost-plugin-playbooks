// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState, ReactNode} from 'react';
import {Link, useRouteMatch} from 'react-router-dom';

import {Line} from 'react-chartjs-2';

import styled from 'styled-components';
import moment from 'moment';

import {useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {Team} from 'mattermost-redux/types/teams';

import {renderDuration} from 'src/components/duration';
import {fetchStats} from 'src/client';
import {Stats} from 'src/types/stats';

type SatisticCountProps = {
    title: ReactNode;
    icon: string;
    count?: ReactNode;
    id?: string;
    to?: string;
}

type URLParams = {
    team: string
    plugin: string
}

const StyledLink = styled(Link)`
    && {
        color: inherit;
    }
`;

const TotalCount = styled.div`
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.15);
    margin: 1em 0;
    text-align: center;
    position: relative;
`;

const Title = styled.div`
    border-bottom: 1px solid rgba(0, 0, 0, 0.15);
    font-size: 13px;
    font-weight: 400;
    padding: 7px 10px;
    text-align: left;
`;

const Icon = styled.i`
    float: right;
    font-size: 16px;
    margin: 0;
`;

const Content = styled.div`
    font-size: 30px;
    font-weight: 600;
    overflow: auto;
    padding: 0.3em 0 0.35em;
`;

const StatisticCount: FC<SatisticCountProps> = (props: SatisticCountProps) => {
    const match = useRouteMatch<URLParams>('/:team/:plugin');
    const titleandcontent = (
        <>
            <Title
                data-testid={`${props.id}Title`}
            >
                {props.title}
                <Icon className={'fa ' + props.icon}/>
            </Title>
            <Content
                data-testid={props.id}
            >
                {props.count}
            </Content>
        </>
    );

    let inner = titleandcontent;
    if (props.to) {
        inner = (
            <StyledLink
                to={`/${match?.params.team}/${match?.params.plugin}/` + props.to}
            >
                {titleandcontent}
            </StyledLink>
        );
    }

    return (
        <TotalCount>
            {inner}
        </TotalCount>
    );
};

type GraphBoxProps = {
    title: string
    xlabel: string
    labels?: string[]
    data?: number[]
}

const GraphBoxContainer = styled.div`
    padding: 10px;
    width: 50%;
    float: left;
`;

const GraphBox: FC<GraphBoxProps> = (props: GraphBoxProps) => {
    const style = getComputedStyle(document.body);
    return (
        <GraphBoxContainer>
            <Line
                legend={{display: false}}
                options={{
                    title: {
                        display: true,
                        text: props.title,
                        fontColor: style.getPropertyValue('--center-channel-color'),
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                beginAtZero: true,
                                callback: (value: number) => (Number.isInteger(value) ? value : null),
                                fontColor: style.getPropertyValue('--center-channel-color'),
                            },
                        }],
                        xAxes: [{
                            scaleLabel: {
                                display: true,
                                labelString: props.xlabel,
                                fontColor: style.getPropertyValue('--center-channel-color'),
                            },
                            ticks: {
                                fontColor: style.getPropertyValue('--center-channel-color'),
                            },
                        }],
                    },
                }}
                data={{
                    labels: props.labels,
                    datasets: [{
                        fill: true,
                        backgroundColor: 'rgba(151,187,205,0.2)',
                        borderColor: 'rgba(151,187,205,1)',
                        pointBackgroundColor: 'rgba(151,187,205,1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(151,187,205,1)',
                        data: props.data,
                    }],
                }}
            />
        </GraphBoxContainer>
    );
};

const BackstageContainer = styled.div`
    margin: 0 auto;
    max-width: 1160px;
    padding: 0 20px;
`;

const BackstageHeader = styled.div`
    display: flex;
    font-size: 2.8rem;
    line-height: 3.6rem;
    align-items: center;
    padding: 4rem 0 3.2rem;
`;

const TeamContainer = styled.div`
    opacity: 0.56;
    margin-left: 1rem;
`;

const StatsContainers = styled.div`
    display: grid;
    column-gap: 30px;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
`;

const StatsView: FC = () => {
    const [stats, setStats] = useState<Stats|null>(null);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    useEffect(() => {
        async function fetchStatsAsync() {
            const ret = await fetchStats(currentTeam.id);
            setStats(ret);
        }
        fetchStatsAsync();
    }, [currentTeam.id]);

    return (
        <BackstageContainer>
            <BackstageHeader data-testid='titleStats'>
                {'Statistics'}
                <TeamContainer>
                    {`(${currentTeam.name})`}
                </TeamContainer>
            </BackstageHeader>
            <StatsContainers>
                <StatisticCount
                    id={'TotalReportedIncidents'}
                    title={'Total Reported Incidents'}
                    icon={'fa-exclamation-triangle'}
                    count={stats?.total_reported_incidents}
                    to={'incidents?status=Reported'}
                />
                <StatisticCount
                    id={'TotalActiveIncidents'}
                    title={'Total Active Incidents'}
                    icon={'fa-exclamation-circle'}
                    count={stats?.total_active_incidents}
                    to={'incidents?status=Active'}
                />
                <StatisticCount
                    id={'TotalActiveParticipants'}
                    title={'Total Active Participants'}
                    icon={'fa-users'}
                    count={stats?.total_active_participants}
                />
                <StatisticCount
                    id={'AverageDuration'}
                    title={'Average Duration'}
                    icon={'fa-clock-o'}
                    count={renderDuration(moment.duration(stats?.average_duration_active_incidents_minutes, 'minutes'))}
                />
            </StatsContainers>
            <div>
                <GraphBox
                    title={'Total incidents by day'}
                    xlabel={'Days ago'}
                    labels={stats?.active_incidents.map((_: number, index: number) => String(index + 1)).reverse()}
                    data={stats?.active_incidents.slice().reverse()}
                />
                <GraphBox
                    title={'Total participants by day'}
                    xlabel={'Days ago'}
                    labels={stats?.people_in_incidents.map((_: number, index: number) => String(index + 1)).reverse()}
                    data={stats?.people_in_incidents.slice().reverse()}
                />
            </div>
            <div>
                <GraphBox
                    title={'Mean-time-to-acknowledge by day (hours)'}
                    xlabel={'Days ago'}
                    labels={stats?.average_start_to_active.map((_: number, index: number) => String(index + 1)).reverse()}
                    data={stats?.average_start_to_active.map((value: number) => Math.floor(value / 3600000)).reverse()}
                />
                <GraphBox
                    title={'Mean-time-to-resolve by day (hours)'}
                    xlabel={'Days ago'}
                    labels={stats?.average_start_to_resolved.map((_: number, index: number) => String(index + 1)).reverse()}
                    data={stats?.average_start_to_resolved.map((value: number) => Math.floor(value / 3600000)).reverse()}
                />
                <div/>
            </div>
        </BackstageContainer>
    );
};

export default StatsView;
