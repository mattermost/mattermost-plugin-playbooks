// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import ReactSelect, {ControlProps, GroupType, OptionsType} from 'react-select';

import styled from 'styled-components';
import {ActionFuncAsync} from 'mattermost-redux/types/actions';
import {UserProfile} from '@mattermost/types/users';
import {GlobalState} from '@mattermost/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {FormattedMessage, useIntl} from 'react-intl';

import Profile from 'src/components/profile/profile';
import {useEnsureProfiles} from 'src/hooks';

import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

interface Props {
    userIds: string[];
    onAddUser: (userid: string) => void;
    onRemoveUser: (userid: string, username: string) => void;
    searchProfiles: (term: string) => ActionFuncAsync;
    getProfiles: () => ActionFuncAsync;
    isDisabled: boolean;
}

const InviteUsersSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const [searchTerm, setSearchTerm] = useState('');
    const invitedUsers = useSelector<GlobalState, UserProfile[]>((state: GlobalState) => props.userIds.map((id) => getUser(state, id)));
    const [searchedUsers, setSearchedUsers] = useState<UserProfile[]>([]);
    useEnsureProfiles(props.userIds);

    // Update the options when the search term is updated
    useEffect(() => {
        const updateOptions = async (term: string) => {
            let profiles;
            if (term.trim().length === 0) {
                profiles = props.getProfiles();
            } else {
                profiles = props.searchProfiles(term);
            }

            //@ts-ignore
            profiles.then(({data}: { data: UserProfile[] }) => {
                setSearchedUsers(data || []);
            });
        };

        updateOptions(searchTerm);
    }, [searchTerm]);

    let invitedProfiles: UserProfile[] = [];
    let nonInvitedProfiles: UserProfile[] = [];

    if (searchTerm.trim().length === 0) {
        // Filter out all the undefined users, which will cast to false in the filter predicate
        invitedProfiles = invitedUsers.filter((user) => user);
        nonInvitedProfiles = searchedUsers.filter(
            (profile: UserProfile) => !props.userIds.includes(profile.id),
        );
    } else {
        searchedUsers.forEach((profile: UserProfile) => {
            if (props.userIds.includes(profile.id)) {
                invitedProfiles.push(profile);
            } else {
                nonInvitedProfiles.push(profile);
            }
        });
    }

    let options: UserProfile[] | GroupType<UserProfile>[] = nonInvitedProfiles;
    if (invitedProfiles.length !== 0) {
        options = [
            {label: 'SELECTED', options: invitedProfiles},
            {label: 'ALL', options: nonInvitedProfiles},
        ];
    }

    let badgeContent = '';
    const numInvitedMembers = props.userIds.length;
    if (numInvitedMembers > 0) {
        badgeContent = `${numInvitedMembers} SELECTED`;
    }

    // Type guard to check whether the current options is a group or a plain list
    const isGroup = (option: UserProfile | GroupType<UserProfile>): option is GroupType<UserProfile> => (
        (option as GroupType<UserProfile>).label
    );

    return (
        <StyledReactSelect
            badgeContent={badgeContent}
            closeMenuOnSelect={false}
            onInputChange={setSearchTerm}
            options={options}
            filterOption={() => true}
            isDisabled={props.isDisabled}
            isMulti={false}
            controlShouldRenderValue={false}
            onChange={(userAdded: UserProfile) => props.onAddUser(userAdded.id)}
            getOptionValue={(user: UserProfile) => user.id}
            formatOptionLabel={(option: UserProfile) => (
                <UserLabel
                    onRemove={() => props.onRemoveUser(option.id, option.username)}
                    id={option.id}
                    invitedUsers={(options.length > 0 && isGroup(options[0])) ? options[0].options : []}
                />
            )}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={false}
            placeholder={formatMessage({defaultMessage: 'Search for people'})}
            components={{DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
            styles={{
                control: (provided: ControlProps<UserProfile, boolean>) => ({
                    ...provided,
                    minHeight: 34,
                }),
            }}
            classNamePrefix='invite-users-selector'
            captureMenuScroll={false}
        />
    );
};

export default InviteUsersSelector;

interface UserLabelProps {
    onRemove: () => void;
    id: string;
    invitedUsers: OptionsType<UserProfile>;
}

const UserLabel = (props: UserLabelProps) => {
    let icon = <PlusIcon/>;
    if (props.invitedUsers.find((user: UserProfile) => user.id === props.id)) {
        icon = <Remove onClick={props.onRemove}><FormattedMessage defaultMessage='Remove'/></Remove>;
    }

    return (
        <>
            <StyledProfile userId={props.id}/>
            {icon}
        </>
    );
};

const Remove = styled.span`
    display: inline-block;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    font-weight: 600;
    line-height: 9px;

    &:hover {
        cursor: pointer;
    }
`;

const StyledProfile = styled(Profile)`
    && .image {
        width: 24px;
        height: 24px;
    }
`;

const PlusIcon = styled.i`
    /* Only shows on hover, controlled in the style from
    .invite-users-selector__option--is-focused */
    display: none;

    &::before {
        color: var(--button-bg);
        content: "\f0415";
        font-family: compass-icons;
        font-size: 14.4px;
        font-style: normal;
        line-height: 17px;
    }
`;

const StyledReactSelect = styled(ReactSelect)`
    flex-grow: 1;
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .invite-users-selector__input {
        color: var(--center-channel-color);
    }

    .invite-users-selector__menu {
        background-color: transparent;
        box-shadow: 0 8px 24px rgba(0 0 0 / 0.12);
    }


    .invite-users-selector__option {
        display: flex;
        height: 36px;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 6px 21px 6px 12px;

        &:active {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }

    .invite-users-selector__option--is-selected {
        background-color: var(--center-channel-bg);
        color: var(--center-channel-color);
    }

    .invite-users-selector__option--is-focused {
        background-color: rgba(var(--button-bg-rgb), 0.04);

        ${PlusIcon} {
            display: inline-block;
        }
    }

    .invite-users-selector__control {
        width: 100%;
        height: 4rem;
        padding-right: 16px;
        padding-left: 3.2rem;
        border: none;
        border-radius: 4px;
        background-color: transparent;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        font-size: 14px;
        transition: all 0.15s ease;
        transition-delay: 0s;

        &--is-focused {
            box-shadow: inset 0 0 0 2px var(--button-bg);
        }

        &::before {
            position: absolute;
            top: 8px;
            left: 16px;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-family: compass-icons, mattermosticons;
            font-size: 18px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        &::after {
            padding: 0 4px;
            border-radius: 4px;

            /* Light / 8% Center Channel Text */
            background: rgba(var(--center-channel-color-rgb), 0.08);
            content: '${(props) => !props.isDisabled && props.badgeContent}';
            font-size: 10px;
            font-weight: 600;
            line-height: 16px;
        }
    }

    .invite-users-selector__group-heading {
        height: 32px;
        padding: 8px 12px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-size: 12px;
        font-weight: 600;
        line-height: 16px;
    }
`;
