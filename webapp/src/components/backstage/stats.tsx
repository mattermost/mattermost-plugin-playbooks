// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState, ReactNode} from 'react';
import {Link, useRouteMatch} from 'react-router-dom';

import {Line, Bar} from 'react-chartjs-2';

import styled from 'styled-components';
import moment from 'moment';

import {Stats} from 'src/types/stats';
import {fetchStats} from 'src/client';
import {renderDuration} from 'src/components/duration';

type Props = {
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

const StatisticCount: FC<Props> = (props: Props) => {
    const match = useRouteMatch<URLParams>('/:team/:plugin');
    const inner = (
        <div className='col-lg-3 col-md-4 col-sm-6'>
            <div className='total-count'>
                <div
                    data-testid={`${props.id}Title`}
                    className='title'
                >
                    {props.title}
                    <i className={'fa ' + props.icon}/>
                </div>
                <div
                    data-testid={props.id}
                    className='content'
                >
                    {props.count}
                </div>
            </div>
        </div>
    );

    if (props.to) {
        return (
            <StyledLink
                to={`/${match?.params.team}/${match?.params.plugin}/` + props.to}
            >
                {inner}
            </StyledLink>
        );
    }

    return inner;
};

const GraphBox = styled.div`
    padding: 10px;
    width: 50%;
    float: left;
`;

const StatsView: FC = () => {
    const [stats, setStats] = useState<Stats|null>(null);

    useEffect(() => {
        async function fetchStatsAsync() {
            const ret = await fetchStats();
            setStats(ret);
        }
        fetchStatsAsync();
    }, []);

    return (
        <div className='IncidentList container-medium'>
            <div className='Backstage__header'>
                <div
                    className='title'
                    data-testid='titleIncident'
                >
                    {'Statistics'}
                    <div className='light'>
                        {'(Serverwide)'}
                    </div>
                </div>
            </div>
            <div className='wrapper--fixed team_statistics'>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'/>
                    <div>
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
                    </div>
                    <GraphBox>
                        <Line
                            legend={{display: false}}
                            options={{
                                title: {
                                    display: true,
                                    text: 'Total Reported/Active Incidents',
                                },
                                scales: {
                                    yAxes: [{
                                        ticks: {
                                            beginAtZero: true,
                                            callback: (value: number) => (Number.isInteger(value) ? value : null),
                                        },
                                    }],
                                    xAxes: [{
                                        scaleLabel: {
                                            display: true,
                                            labelString: 'Days ago',
                                        },
                                    }],
                                },
                            }}
                            data={{
                                labels: stats?.active_incidents.map((value: number, index: number) => String(index + 1)).reverse(),
                                datasets: [{
                                    fill: true,
                                    backgroundColor: 'rgba(151,187,205,0.2)',
                                    borderColor: 'rgba(151,187,205,1)',
                                    pointBackgroundColor: 'rgba(151,187,205,1)',
                                    pointBorderColor: '#fff',
                                    pointHoverBackgroundColor: '#fff',
                                    pointHoverBorderColor: 'rgba(151,187,205,1)',
                                    data: stats?.active_incidents.slice().reverse(),
                                }],
                            }}
                        />
                    </GraphBox>
                    <GraphBox>
                        <Bar
                            legend={{display: false}}
                            options={{
                                title: {
                                    display: true,
                                    text: 'People In Incidents',
                                },
                                scales: {
                                    yAxes: [{
                                        ticks: {
                                            beginAtZero: true,
                                            callback: (value: number) => (Number.isInteger(value) ? value : null),
                                        },
                                    }],
                                    xAxes: [{
                                        scaleLabel: {
                                            display: true,
                                            labelString: 'Days ago',
                                        },
                                    }],
                                },
                            }}
                            data={{
                                labels: stats?.people_in_incidents.map((value: number, index: number) => String(index + 1)).reverse(),
                                datasets: [{
                                    fill: true,
                                    backgroundColor: 'rgba(151,187,205,0.2)',
                                    borderColor: 'rgba(151,187,205,1)',
                                    pointBackgroundColor: 'rgba(151,187,205,1)',
                                    pointBorderColor: '#fff',
                                    pointHoverBackgroundColor: '#fff',
                                    pointHoverBorderColor: 'rgba(151,187,205,1)',
                                    data: stats?.people_in_incidents.slice().reverse(),
                                }],
                            }}
                        />
                    </GraphBox>
                    <div/>
                    <div>
                        <GraphBox>
                            <Line
                                legend={{display: false}}
                                options={{
                                    title: {
                                        display: true,
                                        text: 'Average Start to Active Time (hours)',
                                    },
                                    scales: {
                                        yAxes: [{
                                            ticks: {
                                                beginAtZero: true,
                                                callback: (value: number) => (Number.isInteger(value) ? value : null),
                                            },
                                        }],
                                        xAxes: [{
                                            scaleLabel: {
                                                display: true,
                                                labelString: 'Days ago',
                                            },
                                        }],
                                    },
                                }}
                                data={{
                                    labels: stats?.average_start_to_active.map((value: number, index: number) => String(index + 1)).reverse(),
                                    datasets: [{
                                        fill: true,
                                        backgroundColor: 'rgba(151,187,205,0.2)',
                                        borderColor: 'rgba(151,187,205,1)',
                                        pointBackgroundColor: 'rgba(151,187,205,1)',
                                        pointBorderColor: '#fff',
                                        pointHoverBackgroundColor: '#fff',
                                        pointHoverBorderColor: 'rgba(151,187,205,1)',
                                        data: stats?.average_start_to_active.map((value: number) => Math.floor(value / 3600000)).reverse(),
                                    }],
                                }}
                            />
                        </GraphBox>
                        <GraphBox>
                            <Line
                                legend={{display: false}}
                                options={{
                                    title: {
                                        display: true,
                                        text: 'Average Start to Resolved Time (hours)',
                                    },
                                    scales: {
                                        yAxes: [{
                                            ticks: {
                                                beginAtZero: true,
                                                callback: (value: number) => (Number.isInteger(value) ? value : null),
                                            },
                                        }],
                                        xAxes: [{
                                            scaleLabel: {
                                                display: true,
                                                labelString: 'Days ago',
                                            },
                                        }],
                                    },
                                }}
                                data={{
                                    labels: stats?.average_start_to_resolved.map((value: number, index: number) => String(index + 1)).reverse(),
                                    datasets: [{
                                        fill: true,
                                        backgroundColor: 'rgba(151,187,205,0.2)',
                                        borderColor: 'rgba(151,187,205,1)',
                                        pointBackgroundColor: 'rgba(151,187,205,1)',
                                        pointBorderColor: '#fff',
                                        pointHoverBackgroundColor: '#fff',
                                        pointHoverBorderColor: 'rgba(151,187,205,1)',
                                        data: stats?.average_start_to_resolved.map((value: number) => Math.floor(value / 3600000)).reverse(),
                                    }],
                                }}
                            />
                        </GraphBox>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsView;
