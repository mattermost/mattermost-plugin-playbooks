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

import NoContentPlaybookRunSvg from 'src/components/assets/no_content_playbook_runs_svg';

import {
    StatusFilter,
    StatusOption,
} from 'src/components/backstage/playbook_runs/playbook_run_list/status_filter';

import SearchInput from 'src/components/backstage/playbook_runs/playbook_run_list/search_input';

import {FetchPlaybookRunsParams, PlaybookRun, playbookRunIsActive, playbookRunCurrentStatus} from 'src/types/playbook_run';

import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import {SortableColHeader} from 'src/components/sortable_col_header';

import ProfileSelector from 'src/components/profile/profile_selector';
import {PaginationRow} from 'src/components/pagination_row';
import {
    fetchOwnersInTeam,
    fetchPlaybookRuns,
} from 'src/client';
import Profile from 'src/components/profile/profile';
import StatusBadge from '../status_badge';
import {navigateToUrl, navigateToTeamPluginUrl} from 'src/browser_routing';
import RightDots from 'src/components/assets/right_dots';
import RightFade from 'src/components/assets/right_fade';
import LeftDots from 'src/components/assets/left_dots';
import LeftFade from 'src/components/assets/left_fade';

import './playbook_run_list.scss';
import BackstageListHeader from '../../backstage_list_header';
import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {startPlaybookRun} from 'src/actions';

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

const NoContentPlaybookRunSvgContainer = styled.div`
    @media (max-width: 1000px) {
        display: none;
    }
`;

const NoContentPage = (props: {onNewPlaybookRun: () => void}) => {
    return (
        <NoContentContainer>
            <NoContentTextContainer>
                <NoContentTitle>{'What are playbook runs?'}</NoContentTitle>
                <NoContentDescription>{'Running a playbook orchestrates workflows for your team and tools.'}</NoContentDescription>
                <NoContentButton
                    className='mt-6'
                    onClick={props.onNewPlaybookRun}
                >
                    <i className='icon-plus mr-2'/>
                    {'Run playbook'}
                </NoContentButton>
            </NoContentTextContainer>
            <NoContentPlaybookRunSvgContainer>
                <NoContentPlaybookRunSvg/>
            </NoContentPlaybookRunSvgContainer>
        </NoContentContainer>
    );
};

const statusOptions: StatusOption[] = [
    {value: '', label: 'All'},
    {value: 'Reported', label: 'Reported'},
    {value: 'Active', label: 'Active'},
    {value: 'Resolved', label: 'Resolved'},
    {value: 'Archived', label: 'Archived'},
];

const BackstagePlaybookRunList = () => {
    const dispatch = useDispatch();
    const [showNoPlaybookRuns, setShowNoPlaybookRuns] = useState(false);
    const [playbookRuns, setPlaybookRuns] = useState<PlaybookRun[] | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const selectUser = useSelector<GlobalState>((state) => (userId: string) => getUser(state, userId)) as (userId: string) => UserProfile;

    const query = useLocation().search;
    const [fetchParams, setFetchParams] = useState<FetchPlaybookRunsParams>(
        {
            team_id: currentTeam.id,
            page: 0,
            per_page: BACKSTAGE_LIST_PER_PAGE,
            sort: 'create_at',
            direction: 'desc',
        },
    );

    useEffect(() => {
        const queryForStatus = new URLSearchParams(query).get('status');
        setFetchParams((oldParams) => ({...oldParams, status: queryForStatus || undefined})); //eslint-disable-line no-undefined
    }, [query]);

    useEffect(() => {
        setFetchParams((oldParams) => {
            return {...oldParams, team_id: currentTeam.id};
        });
    }, [currentTeam.id]);

    // When the component is first mounted (or the team changes), determine if there are any
    // playbook runs at all, ignoring filters. Decide once if we should show the "no playbook runs"
    // landing page.
    useEffect(() => {
        async function checkForPlaybookRuns() {
            const playbookRunsReturn = await fetchPlaybookRuns({
                team_id: currentTeam.id,
                page: 0,
                per_page: 1,
            });

            if (playbookRunsReturn.items.length === 0) {
                setShowNoPlaybookRuns(true);
            }
        }

        checkForPlaybookRuns();
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

        fetchPlaybookRunsAsync();

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

    const goToMattermost = () => {
        navigateToUrl(`/${currentTeam.name}`);
    };

    const newPlaybookRun = () => {
        goToMattermost();
        dispatch(startPlaybookRun());
    };

    // Show nothing until after we've completed fetching playbook runs.
    if (playbookRuns === null) {
        return null;
    }

    if (showNoPlaybookRuns) {
        return (
            <NoContentPage onNewPlaybookRun={newPlaybookRun}/>
        );
    }

    return (<>
        <div className='PlaybookRunList container-medium'>
            <div className='Backstage__header'>
                <div
                    className='title'
                    data-testid='titlePlaybookRun'
                >
                    {'Runs'}
                    <div className='light'>
                        {'(' + currentTeam.display_name + ')'}
                    </div>
                </div>
            </div>
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

                {playbookRuns.length === 0 &&
                    <div className='text-center pt-8'>
                        {'There are no runs for '}
                        <i>{currentTeam.display_name}</i>
                        {' matching those filters.'}
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
        </div>
        <RightDots/>
        <RightFade/>
        <LeftDots/>
        <LeftFade/>
    </>);
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

export default BackstagePlaybookRunList;
