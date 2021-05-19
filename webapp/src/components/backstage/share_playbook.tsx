import React from 'react';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {GlobalState} from 'mattermost-redux/types/store';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {Playbook} from 'src/types/playbook';

import SelectUsersBelow from './select_users_below';
import {BackstageSubheader, BackstageSubheaderDescription, RadioContainer, RadioInput, RadioLabel} from './styles';

export interface SharePlaybookProps {
    currentUserId: string;
    onAddUser: (userid: string) => void;
    onRemoveUser: (userid: string) => void;
    onClear: () => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    playbook: Playbook;
}

const UserSelectorWrapper = styled.div`
    margin-left: 24px;
    width: 400px;
    height: 40px;
`;

const selectCurrentTeamName = (state: GlobalState) => getCurrentTeam(state).name;

const SharePlaybook = (props: SharePlaybookProps) => {
    const currentTeamName = useSelector<GlobalState, string>(selectCurrentTeamName);
    const enabled = props.playbook.member_ids.length > 0;
    const radioPressed = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value === 'enabled') {
            if (!enabled) {
                props.onAddUser(props.currentUserId);
            }
        } else {
            props.onClear();
        }
    };
    return (
        <>
            <BackstageSubheader>
                {'Playbook access'}
            </BackstageSubheader>
            <RadioContainer>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='disabled'
                        checked={!enabled}
                        onChange={radioPressed}
                    />
                    {'Everyone on this team ('}
                    <b>{currentTeamName}</b>
                    {') can access.'}
                </RadioLabel>
                <RadioLabel>
                    <RadioInput
                        type='radio'
                        name='enabled'
                        value='enabled'
                        checked={enabled}
                        onChange={radioPressed}
                    />
                    {'Only selected users can access.'}
                </RadioLabel>
            </RadioContainer>
            {enabled &&
                <UserSelectorWrapper>
                    <BackstageSubheaderDescription>
                        {'Only users who you select will be able to edit the playbook or create an incident from this playbook.'}
                    </BackstageSubheaderDescription>
                    <SelectUsersBelow
                        userIds={props.playbook.member_ids}
                        onAddUser={props.onAddUser}
                        onRemoveUser={props.onRemoveUser}
                        searchProfiles={props.searchProfiles}
                        getProfiles={props.getProfiles}
                    />
                </UserSelectorWrapper>
            }
        </>
    );
};

export default SharePlaybook;
