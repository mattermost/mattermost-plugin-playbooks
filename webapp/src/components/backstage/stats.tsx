// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState, ReactNode} from 'react';

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
}

const StatisticCount: FC<Props> = (props: Props) => {
    return (
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

    const playbookLabels = stats?.playbook_uses.map((pbUse) => pbUse.name);
    const playbookValues = stats?.playbook_uses.map((pbUse) => pbUse.num_uses);

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
                            id={'AverageDuration'}
                            title={'Average Duration'}
                            icon={'fa-clock-o'}
                            count={renderDuration(moment.duration(stats?.average_duration_active_incidents_minutes, 'minutes'))}
                        />
                        <StatisticCount
                            id={'AverageReportedToActive'}
                            title={'Average Reported to Active'}
                            icon={'fa-clock-o'}
                            count={renderDuration(moment.duration(stats?.average_reported_to_active_time_minutes, 'minutes'))}
                        />
                        <StatisticCount
                            id={'TotalActiveIncidents'}
                            title={'Total Active Incidents'}
                            icon={'fa-exclamation-triangle'}
                            count={stats?.total_active_incidents}
                        />
                        <StatisticCount
                            id={'TotalActiveParticipants'}
                            title={'Total Active Participants'}
                            icon={'fa-users'}
                            count={stats?.total_active_participants}
                        />
                    </div>
                    <GraphBox>
                        <Line
                            legend={{display: false}}
                            options={{
                                title: {
                                    display: true,
                                    text: 'Total Active Incidents',
                                },
                            }}
                            data={{
                                labels: ['Feb 15', 'Feb 16', 'Yesterday', 'Today'] as string[],
                                datasets: [{
                                    fill: true,
                                    backgroundColor: 'rgba(151,187,205,0.2)',
                                    borderColor: 'rgba(151,187,205,1)',
                                    pointBackgroundColor: 'rgba(151,187,205,1)',
                                    pointBorderColor: '#fff',
                                    pointHoverBackgroundColor: '#fff',
                                    pointHoverBorderColor: 'rgba(151,187,205,1)',
                                    data: [10, 14, 5, 23] as any,
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
                                    text: 'Playbook Uses (Last 6 Weeks)',
                                },
                            }}
                            data={{
                                labels: playbookLabels,
                                datasets: [{
                                    fill: true,
                                    backgroundColor: 'rgba(151,187,205,0.2)',
                                    borderColor: 'rgba(151,187,205,1)',
                                    pointBackgroundColor: 'rgba(151,187,205,1)',
                                    pointBorderColor: '#fff',
                                    pointHoverBackgroundColor: '#fff',
                                    pointHoverBorderColor: 'rgba(151,187,205,1)',
                                    data: playbookValues,
                                }],
                            }}
                        />
                    </GraphBox>
                    <div/>
                </div>
            </div>
        </div>
    );
};

export default StatsView;
