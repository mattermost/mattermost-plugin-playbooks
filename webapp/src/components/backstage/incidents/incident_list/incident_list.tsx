// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState} from 'react';

import moment from 'moment';
import {debounce} from 'debounce';
import {components, ControlProps} from 'react-select';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {useLocation} from 'react-router-dom';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {UserProfile} from 'mattermost-redux/types/users';

import NoContentIncidentSvg from 'src/components/assets/no_content_incidents_svg';
import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import {SortableColHeader} from 'src/components/sortable_col_header';
import {StatusFilter} from 'src/components/backstage/incidents/incident_list/status_filter';
import SearchInput from 'src/components/backstage/incidents/incident_list/search_input';
import ProfileSelector from 'src/components/profile/profile_selector';
import {PaginationRow} from 'src/components/pagination_row';
import {FetchIncidentsParams, Incident, incidentIsActive, incidentCurrentStatus} from 'src/types/incident';
import {
    fetchCommandersInTeam,
    fetchIncidents,
} from 'src/client';
import Profile from 'src/components/profile/profile';
import StatusBadge from '../status_badge';
import {navigateToUrl, navigateToTeamPluginUrl} from 'src/browser_routing';
import RightDots from 'src/components/assets/right_dots';
import RightFade from 'src/components/assets/right_fade';
import LeftDots from 'src/components/assets/left_dots';
import LeftFade from 'src/components/assets/left_fade';

import './incident_list.scss';
import BackstageListHeader from '../../backstage_list_header';
import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {startIncident} from 'src/actions';

const debounceDelay = 300; // in milliseconds

const ControlComponent = (ownProps: ControlProps<any>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <a
                className='IncidentFilter-reset'
                onClick={ownProps.selectProps.onCustomReset}
            >
                {'Reset to all commanders'}
            </a>
        )}
    </div>
);

const NoContentContainer = styled.div`
    display: flex;
    flex-direction: row;
    margin: 0 10vw;
    height: 100%;
    align-items: center;
`;

const NoContentTextContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0 20px;
`;

const NoContentTitle = styled.h2`
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 28px;
    color: var(--center-channel-color);
    text-align: left;
`;

const NoContentDescription = styled.h5`
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 16px;
    line-height: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    text-align: left;
`;

const NoContentButton = styled.button`
    display: inline-flex;
    background: var(--button-bg);
    color: var(--button-color);
    border-radius: 4px;
    border: 0px;
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 16px;
    line-height: 18px;
    align-items: center;
    padding: 14px 24px;
    transition: all 0.15s ease-out;
    align-self: center;

    &:hover {
        opacity: 0.8;
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.8);
    }

    i {
        font-size: 24px;
    }
`;

const NoContentIncidentSvgContainer = styled.div`
    @media (max-width: 1000px) {
        display: none;
    }
`;

const NoContentPage = (props: {onNewIncident: () => void}) => {
    return (
        <NoContentContainer>
            <NoContentTextContainer>
                <NoContentTitle>{'What are Incidents?'}</NoContentTitle>
                <NoContentDescription>{'Incidents are unexpected situations which impact business operations; require an immediate, multi-disciplinary, response; and benefit from a clearly defined process. When the situation is resolved, the incident is ended, and the playbook can be updated to improve the response to similar incidents in the future.'}</NoContentDescription>
                <NoContentButton
                    className='mt-6'
                    onClick={props.onNewIncident}
                >
                    <i className='icon-plus mr-2'/>
                    {'New Incident'}
                </NoContentButton>
            </NoContentTextContainer>
            <NoContentIncidentSvgContainer>
                <NoContentIncidentSvg/>
            </NoContentIncidentSvgContainer>
        </NoContentContainer>
    );
};

const BackstageIncidentList: FC = () => {
    const dispatch = useDispatch();
    const [showNoIncidents, setShowNoIncidents] = useState(false);
    const [incidents, setIncidents] = useState<Incident[] | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const selectUser = useSelector<GlobalState>((state) => (userId: string) => getUser(state, userId)) as (userId: string) => UserProfile;

    const query = useLocation().search;
    const [fetchParams, setFetchParams] = useState<FetchIncidentsParams>(
        {
            team_id: currentTeam.id,
            page: 0,
            per_page: BACKSTAGE_LIST_PER_PAGE,
            sort: 'create_at',
            direction: 'desc',
        },
    );

    useEffect(() => {
        // This mess makes typescript happy because string | null can't be assigned to string | undefined
        const queryForStatus = new URLSearchParams(query).get('status');
        let status: string | undefined;
        if (queryForStatus) {
            status = queryForStatus;
        }
        setFetchParams((oldParams) => ({...oldParams, status}));
    }, [query]);

    useEffect(() => {
        setFetchParams((oldParams) => {
            return {...oldParams, team_id: currentTeam.id};
        });
    }, [currentTeam.id]);

    useEffect(() => {
        let isCanceled = false;
        async function fetchIncidentsAsync() {
            const incidentsReturn = await fetchIncidents(fetchParams);

            // Only show the no incidents welcome page if we fail to find any incidents
            // on first load.
            if (incidents === null && incidentsReturn.items.length === 0) {
                setShowNoIncidents(true);
            }

            if (!isCanceled) {
                setIncidents(incidentsReturn.items);
                setTotalCount(incidentsReturn.total_count);
            }
        }

        fetchIncidentsAsync();

        return () => {
            isCanceled = true;
        };
    }, [fetchParams]);

    function setSearchTerm(term: string) {
        setFetchParams({...fetchParams, search_term: term, page: 0});
    }

    function setStatus(status: string) {
        setFetchParams({...fetchParams, status, page: 0});
    }

    function setPage(page: number) {
        setFetchParams({...fetchParams, page});
    }

    function colHeaderClicked(colName: string) {
        if (fetchParams.sort === colName) {
            // we're already sorting on this column; reverse the direction
            const newDirection = fetchParams.direction === 'asc' ? 'desc' : 'asc';
            setFetchParams({...fetchParams, direction: newDirection});
            return;
        }

        // change to a new column; default to descending for time-based columns, ascending otherwise
        let newDirection = 'desc';
        if (['name', 'is_active'].indexOf(colName) !== -1) {
            newDirection = 'asc';
        }
        setFetchParams({...fetchParams, sort: colName, direction: newDirection});
    }

    async function fetchCommanders() {
        const commanders = await fetchCommandersInTeam(currentTeam.id);
        return commanders.map((c) => selectUser(c.user_id) || {id: c.user_id} as UserProfile);
    }

    function setCommanderId(userId?: string) {
        setFetchParams({...fetchParams, commander_user_id: userId, page: 0});
    }

    function openIncidentDetails(incident: Incident) {
        navigateToTeamPluginUrl(currentTeam.name, `/incidents/${incident.id}`);
    }

    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);

    const isFiltering = (
        fetchParams.search_term ||
        fetchParams.commander_user_id ||
        (fetchParams.status && fetchParams.status !== 'all')
    );

    const resetCommander = () => {
        setCommanderId();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    const goToMattermost = () => {
        navigateToUrl(`/${currentTeam.name}`);
    };

    const newIncident = () => {
        goToMattermost();
        dispatch(startIncident());
    };

    // Show nothing until after we've completed fetching incidents.
    if (incidents === null) {
        return null;
    }

    if (showNoIncidents) {
        return (
            <NoContentPage onNewIncident={newIncident}/>
        );
    }

    return (<>
        <div className='IncidentList container-medium'>
            <div className='Backstage__header'>
                <div
                    className='title'
                    data-testid='titleIncident'
                >
                    {'Incidents'}
                    <div className='light'>
                        {'(' + currentTeam.display_name + ')'}
                    </div>
                </div>
            </div>
            <div
                id='incidentList'
                className='list'
            >
                <div className='IncidentList__filters'>
                    <SearchInput
                        default={fetchParams.search_term}
                        onSearch={debounce(setSearchTerm, debounceDelay)}
                    />
                    <ProfileSelector
                        testId={'commander-filter'}
                        selectedUserId={fetchParams.commander_user_id}
                        placeholder={'Commander'}
                        enableEdit={true}
                        isClearable={true}
                        customControl={ControlComponent}
                        customControlProps={{
                            showCustomReset: Boolean(fetchParams.commander_user_id),
                            onCustomReset: resetCommander,
                        }}
                        controlledOpenToggle={profileSelectorToggle}
                        getUsers={fetchCommanders}
                        onSelectedChange={setCommanderId}
                    />
                    <StatusFilter
                        default={fetchParams.status}
                        onChange={setStatus}
                    />
                </div>
                <BackstageListHeader>
                    <div className='row'>
                        <div className='col-sm-3'>
                            <SortableColHeader
                                name={'Name'}
                                direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'name' : false}
                                onClick={() => colHeaderClicked('name')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={'Status'}
                                direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'status' : false}
                                onClick={() => colHeaderClicked('status')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={'Start Time'}
                                direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'create_at' : false}
                                onClick={() => colHeaderClicked('create_at')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={'End Time'}
                                direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'end_at' : false}
                                onClick={() => colHeaderClicked('end_at')}
                            />
                        </div>
                        <div className='col-sm-3'> {'Commander'} </div>
                    </div>
                </BackstageListHeader>

                {incidents.length === 0 &&
                    <div className='text-center pt-8'>
                        {'There are no incidents for '}
                        <i>{currentTeam.display_name}</i>
                        {' matching those filters.'}
                    </div>
                }
                {incidents.map((incident) => (
                    <div
                        className='row incident-item'
                        key={incident.id}
                        onClick={() => openIncidentDetails(incident)}
                    >
                        <a className='col-sm-3 incident-item__title'>
                            <TextWithTooltip
                                id={incident.id}
                                text={incident.name}
                            />
                        </a>
                        <div className='col-sm-2'>
                            <StatusBadge status={incidentCurrentStatus(incident)}/>
                        </div>
                        <div
                            className='col-sm-2'
                        >
                            {
                                moment(incident.create_at).format('MMM DD LT')
                            }
                        </div>
                        <div className='col-sm-2'>
                            {
                                endedAt(incidentIsActive(incident), incident.end_at)
                            }
                        </div>
                        <div className='col-sm-3'>
                            <Profile userId={incident.commander_user_id}/>
                        </div>
                    </div>
                ))}
                <PaginationRow
                    page={fetchParams.page ? fetchParams.page : 0}
                    perPage={fetchParams.per_page ? fetchParams.per_page : BACKSTAGE_LIST_PER_PAGE}
                    totalCount={totalCount}
                    setPage={setPage}
                />
            </div>
        </div>
        <RightDots/>
        <RightFade/>
        <LeftDots/>
        <LeftFade/>
    </>);
};

const endedAt = (isActive: boolean, time: number) => {
    if (isActive) {
        return '--';
    }

    const mom = moment(time);
    if (mom.isSameOrAfter('2020-01-01')) {
        return mom.format('MMM DD LT');
    }
    return '--';
};

export default BackstageIncidentList;
