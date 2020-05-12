// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {Badge} from 'react-bootstrap';
import classNames from 'classnames';
import moment from 'moment';
import {debounce} from 'debounce';

import {FetchIncidentsParams, Incident} from 'src/types/incident';
import {fetchIncidents} from 'src/client';
import Profile from 'src/components/profile';
import SearchInput from 'src/components/backstage/incident_list/search_input';

import './incident_list.scss';

interface Props {
    currentTeamId: string;
    currentTeamName: string;
}

const debounceDelay = 300; // in milliseconds

export default function IncidentList(props: Props) {
    const [incidents, setIncidents] = useState<Incident[]>([]);

    async function fetchIncidentsFromServer(term?: string) {
        const params: FetchIncidentsParams = {team_id: props.currentTeamId};
        if (term) {
            params.search_term = term;
        }
        const data = await fetchIncidents(params);
        setIncidents(data);
    }

    useEffect(() => {
        fetchIncidentsFromServer();
    }, []);

    return (
        <div className='IncidentList'>
            <div className='header'>
                <div className='title'>
                    {'Incidents'}
                    <div className='light'>
                        {'(' + props.currentTeamName + ')'}
                    </div>
                </div>
            </div>
            <div className='list'>
                <div className='filtering'>
                    <div className='row'>
                        <div className='col-sm-6'>
                            <SearchInput
                                onSearch={debounce(fetchIncidentsFromServer, debounceDelay)}
                            />
                        </div>
                    </div>
                </div>
                <div className='list-header'>
                    <div className='row'>
                        <div className='col-sm-3'> {'Name'} </div>
                        <div className='col-sm-2'> {'Status'} </div>
                        <div className='col-sm-2'> {'Start Date'} </div>
                        <div className='col-sm-2'> {'End Date'} </div>
                        <div className='col-sm-3'> {'Commander'} </div>
                    </div>
                </div>

                {
                    !incidents.length &&
                    <div className='text-center pt-8'>
                        {'There are no incidents for team.'}
                    </div>
                }

                {
                    incidents.map((incident) => (
                        <div
                            className='row incident-item'
                            key={incident.id}
                        >
                            <div className='col-sm-3'> {incident.name} </div>
                            <div className='col-sm-2'>
                                {
                                    <OngoingBadge isActive={incident.is_active}/>
                                }
                            </div>
                            <div
                                className='col-sm-2'
                            >
                                {
                                    moment.unix(incident.created_at).format('DD MMM h:mmA')
                                }
                            </div>
                            <div className='col-sm-2'>
                                {
                                    endedAt(incident.is_active, incident.ended_at)
                                }
                            </div>
                            <div className='col-sm-3'>
                                <Profile userId={incident.commander_user_id}/>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    );
}

function OngoingBadge(props: { isActive: boolean }) {
    const badgeClass = classNames({
        ongoing: props.isActive,
    });
    const badgeText = props.isActive ? 'Ongoing' : 'Ended';

    return (
        <Badge className={badgeClass}>
            {badgeText}
        </Badge>
    );
}

const endedAt = (isActive: boolean, time: number) => {
    if (isActive) {
        return 'Ongoing';
    }

    const mom = moment.unix(time);
    if (mom.isSameOrAfter('2020')) {
        return mom.format('DD MMM h:mmA');
    }
    return '-';
};
