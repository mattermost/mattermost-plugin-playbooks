// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useCallback} from 'react';
import moment from 'moment';
import {debounce} from 'debounce';
import {components, ControlProps} from 'react-select';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {UserProfile} from 'mattermost-redux/types/users';

import {StatusFilter} from 'src/components/backstage/incidents/incident_list/status_filter';
import SearchInput from 'src/components/backstage/incidents/incident_list/search_input';
import ProfileSelector from 'src/components/profile/profile_selector/profile_selector';
import {FetchIncidentsParams, Incident, IncidentWithDetails} from 'src/types/incident';
import {fetchCommandersInTeam, fetchIncidents, fetchIncident, fetchIncidentWithDetails} from 'src/client';
import Profile from 'src/components/profile';
import BackstageIncidentDetails from '../incident_details';
import StatusBadge from '../status_badge';

import './incident_list.scss';
import {OVERLAY_DELAY} from 'src/utils/constants';

const debounceDelay = 300; // in milliseconds

interface Props {
    currentTeamId: string;
    currentTeamName: string;
    getUser: (userId: string) => UserProfile;
}

export function BackstageIncidentList(props: Props) {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [selectedIncident, setSelectedIncident] = useState<IncidentWithDetails | null>(null);

    const [fetchParams, setFetchParams] = useState<FetchIncidentsParams>(
        {team_id: props.currentTeamId},
    );

    useEffect(() => {
        setFetchParams({...fetchParams, team_id: props.currentTeamId});
    }, [props.currentTeamId]);

    useEffect(() => {
        async function fetchIncidentsAsync() {
            const data = await fetchIncidents(fetchParams);
            setIncidents(data);
        }

        fetchIncidentsAsync();
    }, [fetchParams]);

    function setSearchTerm(term: string) {
        setFetchParams({...fetchParams, search_term: term});
    }

    function setStatus(status: string) {
        setFetchParams({...fetchParams, status});
    }

    async function fetchCommanders() {
        const commanders = await fetchCommandersInTeam(props.currentTeamId);
        return commanders.map((c) => props.getUser(c.user_id));
    }

    function setCommanderId(userId?: string) {
        setFetchParams({...fetchParams, commander_user_id: userId});
    }

    async function openIncidentDetails(incident: Incident) {
        try {
            const incidentDetails = await fetchIncidentWithDetails(incident.id) as Incident;
            setSelectedIncident(incidentDetails);
        } catch (e) {
            const incidentWithoutDetails = await fetchIncident(incident.id) as Incident;
            setSelectedIncident(incidentWithoutDetails);
        }
    }

    const closeIncidentDetails = () => {
        setSelectedIncident(null);
    };

    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);
    const ControlComponent = (ownProps: ControlProps<any>) => {
        const resetLink = fetchParams.commander_user_id && (
            <a
                className='IncidentFilter-reset'
                onClick={() => {
                    setCommanderId();
                    setProfileSelectorToggle(!profileSelectorToggle);
                }}
            >
                {'Reset to all commanders'}
            </a>
        );

        return (
            <div>
                <components.Control {...ownProps}/>
                {resetLink}
            </div>
        );
    };

    const isFiltering = (
        fetchParams.search_term ||
        fetchParams.commander_user_id ||
        (fetchParams.status && fetchParams.status !== 'all')
    );

    return (
        <>
            {!selectedIncident && (
                <div className='IncidentList'>
                    <div className='Backstage__header'>
                        <div className='title'>
                            {'Incidents'}
                            <div className='light'>
                                {'(' + props.currentTeamName + ')'}
                            </div>
                        </div>
                    </div>
                    <div className='list'>
                        <div className='IncidentList__filters'>
                            <SearchInput
                                default={fetchParams.search_term}
                                onSearch={debounce(setSearchTerm, debounceDelay)}
                            />
                            <ProfileSelector
                                commanderId={fetchParams.commander_user_id}
                                enableEdit={true}
                                isClearable={true}
                                customControl={ControlComponent}
                                controlledOpenToggle={profileSelectorToggle}
                                getUsers={fetchCommanders}
                                onSelectedChange={setCommanderId}
                            />
                            <StatusFilter
                                default={fetchParams.status}
                                onChange={setStatus}
                            />
                        </div>
                        <div className='Backstage-list-header'>
                            <div className='row'>
                                <div className='col-sm-3'> {'Name'} </div>
                                <div className='col-sm-2'> {'Status'} </div>
                                <div className='col-sm-2'> {'Start Time'} </div>
                                <div className='col-sm-2'> {'End Time'} </div>
                                <div className='col-sm-3'> {'Commander'} </div>
                            </div>
                        </div>

                        {
                            !incidents.length && !isFiltering &&
                            <div className='text-center pt-8'>
                                {'There are no incidents for '}
                                <i>{props.currentTeamName}</i>
                                {'.'}
                            </div>
                        }
                        {
                            !incidents.length && isFiltering &&
                            <div className='text-center pt-8'>
                                {'There are no incidents for '}
                                <i>{props.currentTeamName}</i>
                                {' matching those filters.'}
                            </div>
                        }

                        {
                            incidents.map((incident) => (
                                <div
                                    className='row incident-item'
                                    key={incident.id}
                                    onClick={() => openIncidentDetails(incident)}
                                >
                                    <TextWithTooltip
                                        id={incident.id}
                                        text={incident.name}
                                        className='col-sm-3 incident-item__title'
                                    />
                                    <div className='col-sm-2'>
                                        <StatusBadge isActive={incident.is_active}/>
                                    </div>
                                    <div
                                        className='col-sm-2'
                                    >
                                        {
                                            moment.unix(incident.created_at).format('MMM DD LT')
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
            )}
            {
                selectedIncident &&
                <BackstageIncidentDetails
                    incident={selectedIncident}
                    onClose={closeIncidentDetails}
                />
            }
        </>
    );
}

const endedAt = (isActive: boolean, time: number) => {
    if (isActive) {
        return '--';
    }

    const mom = moment.unix(time);
    if (mom.isSameOrAfter('2020-01-01')) {
        return mom.format('MMM DD LT');
    }
    return '--';
};

const TextWithTooltip = (props: {id: string; text: string; className: string}) => {
    const [ref, setRefState] = useState<HTMLAnchorElement|null>(null);
    const setRef = useCallback((node) => {
        setRefState(node);
    }, []);

    const text = (
        <a
            ref={setRef}
            className={props.className}
        >
            {props.text}
        </a>
    );

    if (ref && ref.offsetWidth < ref.scrollWidth) {
        return (
            <OverlayTrigger
                placement='top'
                delayShow={OVERLAY_DELAY}
                overlay={<Tooltip id={`${props.id}_name`}>{props.text}</Tooltip>}
            >
                {text}
            </OverlayTrigger>
        );
    }

    return text;
};
