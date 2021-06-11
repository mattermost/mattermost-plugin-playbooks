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
} from 'src/components/backstage/playbook_runs/playbook_run_list/status_filter';

import SearchInput from 'src/components/backstage/playbook_runs/playbook_run_list/search_input';

import {
    FetchPlaybookRunsParams,
    PlaybookRun,
    playbookRunCurrentStatus,
    playbookRunIsActive,
} from 'src/types/playbook_run';

import StatusBadge from 'src/components/backstage/playbook_runs/status_badge';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {fetchOwnersInTeam, fetchPlaybookRuns} from 'src/client';
import {navigateToTeamPluginUrl} from 'src/browser_routing';
import ProfileSelector from 'src/components/profile/profile_selector';
import BackstageListHeader from 'src/components/backstage/backstage_list_header';
import {SortableColHeader} from 'src/components/sortable_col_header';
import TextWithTooltip from 'src/components/widgets/text_with_tooltip';

import Profile from 'src/components/profile/profile';
import {PaginationRow} from 'src/components/pagination_row';
import {Playbook} from 'src/types/playbook';
import 'src/components/backstage/playbook_runs/playbook_run_list/playbook_run_list.scss';

const debounceDelay = 300; // in milliseconds

const ControlComponent = (ownProps: ControlProps<any>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <a
                className='PlaybookRunFilter-reset'
                onClick={ownProps.selectProps.onCustomReset}
            >
                {'Reset to all owners'}
            </a>
        )}
    </div>
);

const PlaybookRunListContainer = styled.div`
    padding-top: 32px;
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

const PlaybookRunList = (props: Props) => {
    const [playbookRuns, setPlaybookRuns] = useState<PlaybookRun[] | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const selectUser = useSelector<GlobalState>((state) => (userId: string) => getUser(state, userId)) as (userId: string) => UserProfile;

    const [fetchParams, setFetchParams] = useState<FetchPlaybookRunsParams>(
        {
            team_id: currentTeam.id,
            page: 0,
            per_page: BACKSTAGE_LIST_PER_PAGE,
            sort: 'create_at',
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

        async function fetchPlaybookRunsAsync() {
            const playbookRunsReturn = await fetchPlaybookRuns(fetchParams);

            if (!isCanceled) {
                setPlaybookRuns(playbookRunsReturn.items);
                setTotalCount(playbookRunsReturn.total_count);
            }
        }

        if (props.playbook) {
            fetchPlaybookRunsAsync();
        } else {
            setPlaybookRuns([]);
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

    function openPlaybookRunDetails(playbookRun: PlaybookRun) {
        navigateToTeamPluginUrl(currentTeam.name, `/runs/${playbookRun.id}`);
    }

    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);

    const resetOwner = () => {
        setOwnerId();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    const isFiltering = (
        (fetchParams?.search_term?.length ?? 0) > 0 ||
        (fetchParams?.status?.length ?? 0) > 0 ||
        (fetchParams?.owner_user_id?.length ?? 0) > 0
    );

    // Show nothing until after we've completed fetching playbook runs.
    if (playbookRuns === null) {
        return null;
    }

    return (
        <PlaybookRunListContainer className='PlaybookRunList'>
            <div
                id='playbookRunList'
                className='list'
            >
                <div className='PlaybookRunList__filters'>
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
                <BackstageListHeader>
                    <div className='row'>
                        <div className='col-sm-3'>
                            <SortableColHeader
                                name={'Run name'}
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
                                name={'Start time'}
                                direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'create_at' : false}
                                onClick={() => colHeaderClicked('create_at')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={'End time'}
                                direction={fetchParams.direction ? fetchParams.direction : 'desc'}
                                active={fetchParams.sort ? fetchParams.sort === 'end_at' : false}
                                onClick={() => colHeaderClicked('end_at')}
                            />
                        </div>
                        <div className='col-sm-3'> {'Owner'} </div>
                    </div>
                </BackstageListHeader>

                {playbookRuns.length === 0 && !isFiltering &&
                    <div className='text-center pt-8'>
                        {'There are no runs for this playbook.'}
                    </div>
                }
                {playbookRuns.length === 0 && isFiltering &&
                    <div className='text-center pt-8'>
                        {'There are no runs for this playbook matching those filters.'}
                    </div>
                }
                {playbookRuns.map((playbookRun) => (
                    <div
                        className='row playbook-run-item'
                        key={playbookRun.id}
                        onClick={() => openPlaybookRunDetails(playbookRun)}
                    >
                        <a className='col-sm-3 playbook-run-item__title'>
                            <TextWithTooltip
                                id={playbookRun.id}
                                text={playbookRun.name}
                            />
                        </a>
                        <div className='col-sm-2'>
                            <StatusBadge status={playbookRunCurrentStatus(playbookRun)}/>
                        </div>
                        <div
                            className='col-sm-2'
                        >
                            {
                                formatDate(moment(playbookRun.create_at))
                            }
                        </div>
                        <div className='col-sm-2'>
                            {
                                endedAt(playbookRunIsActive(playbookRun), playbookRun.end_at)
                            }
                        </div>
                        <div className='col-sm-3'>
                            <Profile userId={playbookRun.owner_user_id}/>
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
        </PlaybookRunListContainer>
    );
};

const formatDate = (mom: moment.Moment) => {
    if (mom.isSame(moment(), 'year')) {
        return mom.format('MMM DD LT');
    }
    return mom.format('MMM DD YYYY LT');
};

const endedAt = (isActive: boolean, time: number) => {
    if (isActive) {
        return '--';
    }

    const mom = moment(time);
    if (mom.isSameOrAfter('2020-01-01')) {
        return formatDate(mom);
    }
    return '--';
};

export default PlaybookRunList;
