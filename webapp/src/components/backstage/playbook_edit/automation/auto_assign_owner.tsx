// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {FormattedMessage} from 'react-intl';

import Profile from 'src/components/profile/profile';
import {
    AutomationHeader,
    AutomationTitle,
    SelectorWrapper,
} from 'src/components/backstage/playbook_edit/automation/styles';
import AssignOwnerSelector from 'src/components/backstage/playbook_edit/automation/assign_owner_selector';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';

interface Props {
    enabled: boolean;
    disabled?: boolean;
    onToggle: () => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    ownerID: string;
    onAssignOwner: (userId: string | undefined) => void;
}

export const AutoAssignOwner = (props: Props) => {
    return (
        <AutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                    disabled={props.disabled}
                />
                <div><FormattedMessage defaultMessage='Assign the owner role'/></div>
            </AutomationTitle>
            <SelectorWrapper>
                <AssignOwnerSelector
                    ownerID={props.ownerID}
                    onAddUser={props.onAssignOwner}
                    searchProfiles={props.searchProfiles}
                    getProfiles={props.getProfiles}
                    isDisabled={props.disabled || !props.enabled}
                />
            </SelectorWrapper>
        </AutomationHeader>
    );
};

interface UserRowProps {
    isEnabled: boolean;
}

const UserRow = styled.div<UserRowProps>`
    margin: 12px 0 0 auto;

    padding: 0;

    display: flex;
    flex-direction: row;
`;

const Cross = styled.i`
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 50%;

    color: var(--button-bg);
    // Filling the transparent X in the icon: this sets a background gradient,
    // which is effectively a circle with color --button-color that fills only
    // 50% of the background, transparent outside of it. If we simply add a
    // background color, the icon is misplaced and a weird border appears at the bottom
    background-image: radial-gradient(circle, var(--button-color) 50%, rgba(0, 0, 0, 0) 50%);

    visibility: hidden;
`;

const UserPic = styled.div`
    .PlaybookRunProfile {
        flex-direction: column;

        .name {
            display: none;
            position: absolute;
            bottom: -24px;
            margin-left: auto;
        }
    }

    :not(:first-child) {
        margin-left: -16px;
    }

    position: relative;
    transition: transform .4s;

    :hover {
        z-index: 1;
        transform: translateY(-8px);

        ${Cross} {
            visibility: visible;
        }

        .name {
            display: block;
        }
    }

    && img {
        // We need both background-color and border color to imitate the color in the background
        background-color: var(--center-channel-bg);
        border: 2px solid rgba(var(--center-channel-color-rgb), 0.04);
    }

`;

interface UserProps {
    userIds: string[];
    onRemoveUser: (userId: string) => void;
    isEnabled: boolean;
}

const Users = (props: UserProps) => {
    return (
        <UserRow isEnabled={props.isEnabled}>
            {props.userIds.map((userId: string) => (
                <UserPic key={userId}>
                    <Profile userId={userId}/>
                    <Cross
                        className='fa fa-times-circle'
                        onClick={() => props.onRemoveUser(userId)}
                    />
                </UserPic>
            ))}
        </UserRow>
    );
};
