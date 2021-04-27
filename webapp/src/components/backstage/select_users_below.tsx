import React, {FC} from 'react';
import styled from 'styled-components';
import {ActionFunc} from 'mattermost-redux/types/actions';

import Profile from '../profile/profile';

import ProfileAutocomplete from './profile_autocomplete';

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

const BelowLineProfile = styled(Profile)`
    flex-grow: 1;
    overflow: hidden;
`;

export interface SelectUsersBelowProps {
    userIds: string[];
    onAddUser: (userid: string) => void;
    onRemoveUser: (userid: string) => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
}

const SelectUsersBelow: FC<SelectUsersBelowProps> = (props: SelectUsersBelowProps) => {
    return (
        <ProfileAutocompleteContainer>
            <ProfileAutocomplete
                onAddUser={props.onAddUser}
                userIds={props.userIds}
                searchProfiles={props.searchProfiles}
                getProfiles={props.getProfiles}
            />
            <UserList>
                {props.userIds.map((userId) => (
                    <UserLine
                        data-testid='user-line'
                        key={userId}
                    >
                        <BelowLineProfile userId={userId}/>
                        {
                            props.userIds.length > 1 &&
                            <RemoveLink onClick={() => props.onRemoveUser(userId)}>{'Remove'}</RemoveLink>
                        }
                    </UserLine>
                ))}
            </UserList>
        </ProfileAutocompleteContainer>
    );
};

export default SelectUsersBelow;
