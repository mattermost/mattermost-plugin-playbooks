// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import debounce from 'debounce';
import {components, ControlProps} from 'react-select';

import styled from 'styled-components';

import {useSelector} from 'react-redux';

import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {UserProfile} from 'mattermost-redux/types/users';

import {FetchPlaybookRunsParams} from 'src/types/playbook_run';
import ProfileSelector from 'src/components/profile/profile_selector';

import TeamSelector from 'src/components/team/team_selector';

import {fetchOwnersInTeam} from 'src/client';

import SearchInput from './search_input';
import {StatusFilter, StatusOption} from './status_filter';

interface Props {
    fetchParams: FetchPlaybookRunsParams
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>
    fixedTeam?: boolean
}

const searchDebounceDelayMilliseconds = 300;

const statusOptions: StatusOption[] = [
    {value: '', label: 'All'},
    {value: 'Reported', label: 'Reported'},
    {value: 'Active', label: 'Active'},
    {value: 'Resolved', label: 'Resolved'},
    {value: 'Archived', label: 'Archived'},
];

const ControlComponentAnchor = styled.a`
    display: inline-block;
    margin: 0 0 8px 12px;
    font-weight: 600;
    font-size: 12px;
    position: relative;
    top: -4px;
`;

const controlComponent = (ownProps: ControlProps<any>, filterName: string) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                {'Reset to all ' + filterName}
            </ControlComponentAnchor>
        )}
    </div>
);

const OwnerControlComponent = (ownProps: ControlProps<any>) => {
    return controlComponent(ownProps, 'owners');
};

const TeamControlComponent = (ownProps: ControlProps<any>) => {
    return controlComponent(ownProps, 'teams');
};

const Filters = ({fetchParams, setFetchParams, fixedTeam}: Props) => {
    const teams = useSelector(getMyTeams);
    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);
    const [teamSelectorToggle, setTeamSelectorToggle] = useState(false);

    const setOwnerId = (userId?: string) => {
        setFetchParams((oldParams) => {
            return {...oldParams, owner_user_id: userId, page: 0}
            ;
        });
    };

    const setTeamId = (teamId?: string) => {
        setFetchParams((oldParams) => {
            return {...oldParams, team_id: teamId, page: 0}
            ;
        });
    };

    const setStatus = (statuses: string[]) => {
        setFetchParams((oldParams) => {
            return {...oldParams, statuses, page: 0}
            ;
        });
    };

    const setSearchTerm = (term: string) => {
        setFetchParams((oldParams) => {
            return {...oldParams, search_term: term, page: 0}
            ;
        });
    };

    const resetOwner = () => {
        setOwnerId();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    const resetTeam = () => {
        setTeamId();
        setTeamSelectorToggle(!teamSelectorToggle);
    };

    async function fetchOwners() {
        const owners = await fetchOwnersInTeam(fetchParams.team_id || '');
        return owners.map((c) => {
            //@ts-ignore TODO Fix this strangeness
            return {...c, id: c.user_id} as UserProfile;
        });
    }

    return (
        <div className='PlaybookRunList__filters'>
            <SearchInput
                default={fetchParams.search_term}
                onSearch={debounce(setSearchTerm, searchDebounceDelayMilliseconds)}
            />
            <ProfileSelector
                testId={'owner-filter'}
                selectedUserId={fetchParams.owner_user_id}
                placeholder={'Owner'}
                enableEdit={true}
                isClearable={true}
                customControl={OwnerControlComponent}
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
                default={fetchParams.statuses}
                onChange={setStatus}
            />
            {teams.length > 1 && !fixedTeam &&
                <TeamSelector
                    testId={'team-filter'}
                    selectedTeamId={fetchParams.team_id}
                    placeholder={'Team'}
                    enableEdit={true}
                    isClearable={true}
                    customControl={TeamControlComponent}
                    customControlProps={{
                        showCustomReset: Boolean(fetchParams.team_id),
                        onCustomReset: resetTeam,
                    }}
                    controlledOpenToggle={teamSelectorToggle}
                    teams={teams}
                    onSelectedChange={setTeamId}
                />
            }
        </div>
    );
};

export default Filters;
