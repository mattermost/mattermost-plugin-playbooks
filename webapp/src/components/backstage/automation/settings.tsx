// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';

import styled from 'styled-components';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {InviteUsers} from 'src/components/backstage/automation/invite_users';

import {BackstageHeaderHelpText, BackstageHeaderTitle} from 'src/components/backstage/styles';

interface Props {
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    userIds: string[];
    inviteUsersEnabled: boolean;
    onToggleInviteUsers: () => void;
    onAddUser: (userId: string) => void;
    onRemoveUser: (userId: string) => void;
}

export const AutomationSettings: FC<Props> = (props: Props) => {
    return (
        <>
            <BackstageHeaderTitle>
                {'Automation'}
            </BackstageHeaderTitle>
            <BackstageHeaderHelpText>
                {'Select what actions take place after certain situations are triggered.'}
            </BackstageHeaderHelpText>
            <Section>
                <SectionTitle>
                    {'When an incident starts'}
                </SectionTitle>
                <Setting>
                    <InviteUsers
                        enabled={props.inviteUsersEnabled}
                        onToggle={props.onToggleInviteUsers}
                        searchProfiles={props.searchProfiles}
                        getProfiles={props.getProfiles}
                        userIds={props.userIds}
                        onAddUser={props.onAddUser}
                        onRemoveUser={props.onRemoveUser}
                    />
                </Setting>
            </Section>
        </>
    );
};

const Section = styled.div`
    margin: 32px 0;
`;

const SectionTitle = styled.div`
    font-weight: 600;
    margin: 0 0 32px 0;
`;

const Setting = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    margin-bottom: 24px;
`;
