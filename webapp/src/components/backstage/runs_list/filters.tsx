// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import debounce from 'debounce';
import {components, ControlProps} from 'react-select';
import styled from 'styled-components';
import {useSelector} from 'react-redux';

import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {UserProfile} from 'mattermost-redux/types/users';

import {useIntl} from 'react-intl';

import {FetchPlaybookRunsParams, PlaybookRunStatus} from 'src/types/playbook_run';
import ProfileSelector, {Option as ProfileOption} from 'src/components/profile/profile_selector';
import PlaybookSelector, {Option as PlaybookOption} from 'src/components/backstage/runs_list/playbook_selector';
import TeamSelector, {Option as TeamOption} from 'src/components/team/team_selector';
import {fetchOwnersInTeam, clientFetchPlaybooks} from 'src/client';
import {Playbook} from '../../../types/playbook';

import SearchInput from './search_input';
import CheckboxInput from './checkbox_input';

interface Props {
    fetchParams: FetchPlaybookRunsParams
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>
    fixedTeam?: boolean
    fixedPlaybook?: boolean
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

const controlComponent = (ownProps: ControlProps<TeamOption, boolean> | ControlProps<ProfileOption, boolean> | ControlProps<PlaybookOption, boolean>, filterName: string) => (
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

const PlaybookControlComponent = (ownProps: ControlProps<PlaybookOption, boolean>) => {
    return controlComponent(ownProps, 'playbooks');
};

const Filters = ({fetchParams, setFetchParams, fixedTeam, fixedPlaybook}: Props) => {
    const {formatMessage} = useIntl();
    const teams = useSelector(getMyTeams);
    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);
    const [teamSelectorToggle, setTeamSelectorToggle] = useState(false);
    const [playbookSelectorToggle, setPlaybookSelectorToggle] = useState(false);

    const myRunsOnly = fetchParams.participant_or_follower_id === 'me';
    const setMyRunsOnly = (checked?: boolean) => {
        setFetchParams((oldParams) => {
            return {...oldParams, participant_or_follower_id: checked ? 'me' : ''};
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

    const setPlaybookId = (playbookId?: string) => {
        setFetchParams((oldParams) => {
            return {...oldParams, playbook_id: playbookId, page: 0};
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

    const resetPlaybook = () => {
        setPlaybookId();
        setPlaybookSelectorToggle(!playbookSelectorToggle);
    };

    async function fetchOwners() {
        const owners = await fetchOwnersInTeam(fetchParams.team_id || '');
        return owners.map((c) => {
            //@ts-ignore TODO Fix this strangeness
            return {...c, id: c.user_id} as UserProfile;
        });
    }

    async function fetchPlaybooks() {
        const playbooks = await clientFetchPlaybooks(fetchParams.team_id || '', {team_id: fetchParams.team_id || '', sort: 'title'});
        return playbooks ? playbooks.items : {} as Playbook[];
    }

    return (
        <PlaybookRunListFilters>
            <SearchInput
                testId={'search-filter'}
                default={fetchParams.search_term}
                onSearch={debounce(setSearchTerm, searchDebounceDelayMilliseconds)}
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
            {!fixedPlaybook &&
                <PlaybookSelector
                    testId={'playbook-filter'}
                    selectedPlaybookId={fetchParams.playbook_id}
                    placeholder={formatMessage({defaultMessage: 'Playbook'})}
                    enableEdit={true}
                    isClearable={true}
                    customControl={PlaybookControlComponent}
                    customControlProps={{
                        showCustomReset: Boolean(fetchParams.playbook_id),
                        onCustomReset: resetPlaybook,
                    }}
                    controlledOpenToggle={playbookSelectorToggle}
                    getPlaybooks={fetchPlaybooks}
                    onSelectedChange={setPlaybookId}
                />
            }
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
