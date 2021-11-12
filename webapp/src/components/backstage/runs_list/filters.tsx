// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import debounce from 'debounce';
import {components, ControlProps} from 'react-select';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {UserProfile} from 'mattermost-redux/types/users';

import {FetchPlaybookRunsParams, PlaybookRunStatus} from 'src/types/playbook_run';
import ProfileSelector, {Option as ProfileOption} from 'src/components/profile/profile_selector';
import TeamSelector, {Option as TeamOption} from 'src/components/team/team_selector';
import {fetchOwnersInTeam} from 'src/client';
import SearchInput from 'src/components/backstage/search_input';
import CheckboxInput from 'src/components/backstage/runs_list/checkbox_input';

interface Props {
    fetchParams: FetchPlaybookRunsParams
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>
    fixedTeam?: boolean
}

const searchDebounceDelayMilliseconds = 300;

const ControlComponentAnchor = styled.a`
    display: inline-block;
    margin: 0 0 8px 12px;
    font-weight: 600;
    font-size: 12px;
    position: relative;
    top: -4px;
`;

const PlaybookRunListFilters = styled.div`
    display: flex;
    align-items: center;
    margin: 0 -4px 20px;

    > div {
        padding: 0 4px;
    }
`;

const controlComponent = (ownProps: ControlProps<TeamOption, boolean> | ControlProps<ProfileOption, boolean>, filterName: string) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                {'Reset to all ' + filterName}
            </ControlComponentAnchor>
        )}
    </div>
);

const OwnerControlComponent = (ownProps: ControlProps<ProfileOption, boolean>) => {
    return controlComponent(ownProps, 'owners');
};

const TeamControlComponent = (ownProps: ControlProps<TeamOption, boolean>) => {
    return controlComponent(ownProps, 'teams');
};

const Filters = ({fetchParams, setFetchParams, fixedTeam}: Props) => {
    const {formatMessage} = useIntl();
    const teams = useSelector(getMyTeams);
    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);
    const [teamSelectorToggle, setTeamSelectorToggle] = useState(false);

    const myRunsOnly = fetchParams.participant_id === 'me';
    const setMyRunsOnly = (checked?: boolean) => {
        setFetchParams((oldParams) => {
            return {...oldParams, participant_id: checked ? 'me' : ''};
        });
    };

    const setOwnerId = (userId?: string) => {
        setFetchParams((oldParams) => {
            return {...oldParams, owner_user_id: userId, page: 0};
        });
    };

    const setTeamId = (teamId?: string) => {
        setFetchParams((oldParams) => {
            return {...oldParams, team_id: teamId, page: 0};
        });
    };

    const setFinishedRuns = (checked?: boolean) => {
        const statuses = checked ? [PlaybookRunStatus.InProgress, PlaybookRunStatus.Finished] : [PlaybookRunStatus.InProgress];
        setFetchParams((oldParams) => {
            return {...oldParams, statuses, page: 0};
        });
    };

    const setSearchTerm = (term: string) => {
        setFetchParams((oldParams) => {
            return {...oldParams, search_term: term, page: 0};
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
        <PlaybookRunListFilters>
            <SearchInput
                testId={'search-filter'}
                default={fetchParams.search_term}
                onSearch={debounce(setSearchTerm, searchDebounceDelayMilliseconds)}
                placeholder={formatMessage({defaultMessage: 'Search by run name'})}
            />
            <CheckboxInput
                testId={'my-runs-only'}
                text={formatMessage({defaultMessage: 'My runs only'})}
                checked={myRunsOnly}
                onChange={setMyRunsOnly}
            />
            <CheckboxInput
                testId={'finished-runs'}
                text={formatMessage({defaultMessage: 'Include finished'})}
                checked={(fetchParams.statuses?.length ?? 0) > 1}
                onChange={setFinishedRuns}
            />
            <ProfileSelector
                testId={'owner-filter'}
                selectedUserId={fetchParams.owner_user_id}
                placeholder={formatMessage({defaultMessage: 'Owner'})}
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
            {teams.length > 1 && !fixedTeam &&
                <TeamSelector
                    testId={'team-filter'}
                    selectedTeamId={fetchParams.team_id}
                    placeholder={formatMessage({defaultMessage: 'Team'})}
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
        </PlaybookRunListFilters>
    );
};

export default Filters;
