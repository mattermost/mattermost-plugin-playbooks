// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState} from 'react';
import moment from 'moment';
import {debounce} from 'debounce';
import {components, ControlProps} from 'react-select';
import {Switch, Route, useRouteMatch} from 'react-router-dom';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {UserProfile} from 'mattermost-redux/types/users';

import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import {SortableColHeader} from 'src/components/sortable_col_header';
import {StatusFilter} from 'src/components/backstage/incidents/incident_list/status_filter';
import SearchInput from 'src/components/backstage/incidents/incident_list/search_input';
import ProfileSelector from 'src/components/profile/profile_selector';
import {PaginationRow} from 'src/components/pagination_row';
import {FetchIncidentsParams, Incident} from 'src/types/incident';
import {
    fetchCommandersInTeam,
    fetchIncidents,
} from 'src/client';
import Profile from 'src/components/profile/profile';
import StatusBadge from '../status_badge';
import {navigateToTeamPluginUrl} from 'src/browser_routing';

import './incident_list.scss';
import BackstageListHeader from '../../backstage_list_header';
import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';

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

const BackstageIncidentList: FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const match = useRouteMatch();
    const selectUser = useSelector<GlobalState>((state) => (userId: string) => getUser(state, userId)) as (userId: string) => UserProfile;

    const [fetchParams, setFetchParams] = useState<FetchIncidentsParams>(
        {
            team_id: currentTeam.id,
            page: 0,
            per_page: BACKSTAGE_LIST_PER_PAGE,
            sort: 'create_at',
            order: 'desc',
        },
    );

    useEffect(() => {
        setFetchParams((oldParams) => {
            return {...oldParams, team_id: currentTeam.id};
        });
    }, [currentTeam.id]);

    useEffect(() => {
        async function fetchIncidentsAsync() {
            const incidentsReturn = await fetchIncidents(fetchParams);
            setIncidents(incidentsReturn.items);
            setTotalCount(incidentsReturn.total_count);
        }

        fetchIncidentsAsync();
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
            // we're already sorting on this column; reverse the order
            const newOrder = fetchParams.order === 'asc' ? 'desc' : 'asc';
            setFetchParams({...fetchParams, order: newOrder});
            return;
        }

        // change to a new column; default to descending for time-based columns, ascending otherwise
        let newOrder = 'desc';
        if (['name', 'status'].indexOf(colName) !== -1) {
            newOrder = 'asc';
        }
        setFetchParams({...fetchParams, sort: colName, order: newOrder});
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

    const listComponent = (
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
                                order={fetchParams.order ? fetchParams.order : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'name' : false}
                                onClick={() => colHeaderClicked('name')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={'Status'}
                                order={fetchParams.order ? fetchParams.order : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'status' : false}
                                onClick={() => colHeaderClicked('status')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={'Start Time'}
                                order={fetchParams.order ? fetchParams.order : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'create_at' : false}
                                onClick={() => colHeaderClicked('create_at')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={'End Time'}
                                order={fetchParams.order ? fetchParams.order : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'end_at' : false}
                                onClick={() => colHeaderClicked('end_at')}
                            />
                        </div>
                        <div className='col-sm-3'> {'Commander'} </div>
                    </div>
                </BackstageListHeader>

                {
                    !incidents.length && !isFiltering &&
                    <div className='text-center pt-8'>
                        {'There are no incidents for '}
                        <i>{currentTeam.display_name}</i>
                        {'.'}
                    </div>
                }
                {
                    !incidents.length && isFiltering &&
                    <div className='text-center pt-8'>
                        {'There are no incidents for '}
                        <i>{currentTeam.display_name}</i>
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
                            <a className='col-sm-3 incident-item__title'>
                                <TextWithTooltip
                                    id={incident.id}
                                    text={incident.name}
                                />
                            </a>
                            <div className='col-sm-2'>
                                <StatusBadge isActive={incident.is_active}/>
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
                                    endedAt(incident.is_active, incident.end_at)
                                }
                            </div>
                            <div className='col-sm-3'>
                                <Profile userId={incident.commander_user_id}/>
                            </div>
                        </div>
                    ))
                }
                <PaginationRow
                    page={fetchParams.page ? fetchParams.page : 0}
                    perPage={fetchParams.per_page ? fetchParams.per_page : BACKSTAGE_LIST_PER_PAGE}
                    totalCount={totalCount}
                    setPage={setPage}
                />
            </div>
        </div>
    );

    return (
        <Switch>
            <Route
                exact={true}
                path={match.path}
            >
                {listComponent}
            </Route>
        </Switch>
    );
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
