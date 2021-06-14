// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {components, ControlProps} from 'react-select';
import {debounce} from 'debounce';
import moment from 'moment';

import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {UserProfile} from 'mattermost-redux/types/users';
import styled from 'styled-components';

import {
    StatusFilter,
    StatusOption,
} from 'src/components/backstage/incidents/incident_list/status_filter';
import {FetchIncidentsParams, Incident} from 'src/types/incident';
import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {fetchOwnersInTeam, fetchIncidents} from 'src/client';
import {navigateToTeamPluginUrl} from 'src/browser_routing';
import SearchInput from 'src/components/backstage/incidents/incident_list/search_input';
import ProfileSelector from 'src/components/profile/profile_selector';
import {SortableColHeader} from 'src/components/sortable_col_header';
import {PaginationRow} from 'src/components/pagination_row';
import {Playbook} from 'src/types/playbook';
import 'src/components/backstage/incidents/incident_list/incident_list.scss';
import Row from 'src/components/backstage/playbooks/incident_list/row';

const debounceDelay = 300; // in milliseconds

const ControlComponent = (ownProps: ControlProps<any>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <a
                className='IncidentFilter-reset'
                onClick={ownProps.selectProps.onCustomReset}
            >
                {'Reset to all owners'}
            </a>
        )}
    </div>
);

const IncidentListContainer = styled.div`
    padding-top: 32px;
`;

const IncidentListHeader = styled.div`
    font-weight: 600;
    font-size: 11px;
    line-height: 36px;
    color: var(--center-channel-color-72);
    background-color: var(--center-channel-color-04);
    border-radius: 4px;
    padding: 0 1.6rem;
`;

const statusOptions: StatusOption[] = [
    {value: '', label: 'All'},
    {value: 'Reported', label: 'Reported'},
    {value: 'Active', label: 'Active'},
    {value: 'Resolved', label: 'Resolved'},
    {value: 'Archived', label: 'Archived'},
];

interface Props {
    playbook: Playbook | null
}

const IncidentList = (props: Props) => {
    const [incidents, setIncidents] = useState<Incident[] | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const selectUser = useSelector<GlobalState>((state) => (userId: string) => getUser(state, userId)) as (userId: string) => UserProfile;
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const [fetchParams, setFetchParams] = useState<FetchIncidentsParams>(
        {
            team_id: currentTeam.id,
            page: 0,
            per_page: BACKSTAGE_LIST_PER_PAGE,
            sort: 'last_update_at',
            direction: 'desc',
            playbook_id: props.playbook?.id,
        },
    );

    useEffect(() => {
        setFetchParams((oldParams) => {
            return {...oldParams, team_id: currentTeam.id};
        });
    }, [currentTeam.id]);

    useEffect(() => {
        let isCanceled = false;

        async function fetchIncidentsAsync() {
            const incidentsReturn = await fetchIncidents(fetchParams);

            if (!isCanceled) {
                setIncidents(incidentsReturn.items);
                setTotalCount(incidentsReturn.total_count);
            }
        }

        if (props.playbook) {
            fetchIncidentsAsync();
        } else {
            setIncidents([]);
            setTotalCount(0);
        }

        return () => {
            isCanceled = true;
        };
    }, [fetchParams, props.playbook]);

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

    async function fetchOwners() {
        const owners = await fetchOwnersInTeam(currentTeam.id);
        return owners.map((c) => selectUser(c.user_id) || {id: c.user_id} as UserProfile);
    }

    function setOwnerId(userId?: string) {
        setFetchParams({...fetchParams, owner_user_id: userId, page: 0});
    }

    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);

    const resetOwner = () => {
        setOwnerId();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    // Show nothing until after we've completed fetching incidents.
    if (incidents === null) {
        return null;
    }

    return (
        <IncidentListContainer className='IncidentList'>
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
                        testId={'owner-filter'}
                        selectedUserId={fetchParams.owner_user_id}
                        placeholder={'Owner'}
                        enableEdit={true}
                        isClearable={true}
                        customControl={ControlComponent}
                        customControlProps={{
                            showCustomReset: Boolean(fetchParams.owner_user_id),
                            onCustomReset: resetOwner,
                        }}
                        controlledOpenToggle={profileSelectorToggle}
                        getUsers={fetchOwners}
                        onSelectedChange={setOwnerId}
                    />
                    <StatusFilter
                        options={statusOptions}
                        default={fetchParams.status}
                        onChange={setStatus}
                    />
                </div>
                <IncidentListHeader>
                    <div className='row'>
                        <div className='col-sm-4'>
                            <SortableColHeader
                                name={'Run Name'}
                                direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'name' : false}
                                onClick={() => colHeaderClicked('name')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={'Status / Last update'}
                                direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'last_update_at' : false}
                                onClick={() => colHeaderClicked('last_update_at')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={'Duration / Started on'}
                                direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'create_at' : false}
                                onClick={() => colHeaderClicked('create_at')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            {'Owner / Participants'}
                        </div>
                        <div className='col-sm-2'>
                            {'Tasks finished'}
                        </div>
                    </div>
                </IncidentListHeader>

                {incidents.length === 0 &&
                <div className='text-center pt-8'>
                    {'There are no incidents for this playbook.'}
                </div>
                }
                {incidents.map((incident) => (
                    <Row
                        key={incident.id}
                        incident={incident}
                    />
                ))}
                <PaginationRow
                    page={fetchParams.page ? fetchParams.page : 0}
                    perPage={fetchParams.per_page ? fetchParams.per_page : BACKSTAGE_LIST_PER_PAGE}
                    totalCount={totalCount}
                    setPage={setPage}
                />
            </div>
        </IncidentListContainer>
    );
};

export default IncidentList;
