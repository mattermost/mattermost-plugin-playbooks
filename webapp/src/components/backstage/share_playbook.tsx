import React, {FC} from 'react';

import styled from 'styled-components';

import {ActionFunc} from 'mattermost-redux/types/actions';

import ProfileAutocomplete from 'src/components/backstage/profile_autocomplete';
import Profile from 'src/components/profile/profile';
import {Playbook} from 'src/types/playbook';

export interface SharePlaybookProps {
    onAddUser: (userid: string) => void;
    onRemoveUser: (userid: string) => void;
    searchProfiles: (term: string) => ActionFunc;
    playbook: Playbook;
}

const ProfileAutocompleteContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const UserLine = styled.div`
    display: flex;
    flex-direction: row;
    margin: 10px 0;
`;

const RemoveLink = styled.a`
    flex-shrink: 0;
    font-weight: normal;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color), 0.56);
`;

const SharePlaybookProfile = styled(Profile)`
    flex-grow: 1;
    overflow: hidden;
`;

const SharePlaybook: FC<SharePlaybookProps> = (props: SharePlaybookProps) => {
    return (
        <ProfileAutocompleteContainer>
            <ProfileAutocomplete
                onAddUser={props.onAddUser}
                userIds={props.playbook.member_ids}
                searchProfiles={props.searchProfiles}
            />
            {props.playbook.member_ids.map((userId) => (
                <UserLine key={userId}>
                    <SharePlaybookProfile userId={userId}/>
                    <RemoveLink onClick={() => props.onRemoveUser(userId)} >{'Remove'}</RemoveLink>
                </UserLine>
            ))}
        </ProfileAutocompleteContainer>
    );
};

export default SharePlaybook;
