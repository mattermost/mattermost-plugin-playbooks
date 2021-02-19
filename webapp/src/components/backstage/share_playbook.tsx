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
    getProfiles: () => ActionFunc;
    playbook: Playbook;
}

const ProfileAutocompleteContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const UserLine = styled.div`
    display: flex;
    align-items: center;
    margin: 12px 0;
`;

const UserList = styled.div`
    margin: 12px 0;
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
                getProfiles={props.getProfiles}
            />
            <UserList>
                {props.playbook.member_ids.map((userId) => (
                    <UserLine
                        data-testid='user-line'
                        key={userId}
                    >
                        <SharePlaybookProfile userId={userId}/>
                        {
                            props.playbook.member_ids.length > 1 &&
                            <RemoveLink onClick={() => props.onRemoveUser(userId)}>{'Remove'}</RemoveLink>
                        }
                    </UserLine>
                ))}
            </UserList>
        </ProfileAutocompleteContainer>
    );
};

export default SharePlaybook;
