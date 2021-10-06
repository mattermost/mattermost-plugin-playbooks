// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {PatternedInput} from 'src/components/backstage/automation/patterned_input';
import {InputKeywords} from 'src/components/backstage/automation/input_keywords';
import {PatternedTextArea} from 'src/components/backstage/automation/patterned_text_area';

import {InviteUsers} from 'src/components/backstage/automation/invite_users';
import {AutoAssignOwner} from 'src/components/backstage/automation/auto_assign_owner';
import {Broadcast} from 'src/components/backstage/automation/broadcast';
import {ExportChannelOnArchive} from 'src/components/backstage/automation/export_channel_on_archive';

import {MessageOnJoin} from 'src/components/backstage/automation/message_on_join';

interface Props {
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    userIds: string[];
    inviteUsersEnabled: boolean;
    onToggleInviteUsers: () => void;
    onAddUser: (userId: string) => void;
    onRemoveUser: (userId: string) => void;
    defaultOwnerID: string;
    defaultOwnerEnabled: boolean;
    onToggleDefaultOwner: () => void;
    onAssignOwner: (userId: string | undefined) => void;
    broadcastChannelIds: string[];
    broadcastEnabled: boolean;
    onToggleBroadcastChannel: () => void;
    onBroadcastChannelsSelected: (channelIds: string[]) => void;
    webhookOnCreationEnabled: boolean;
    onToggleWebhookOnCreation: () => void;
    webhookOnCreationChange: (url: string) => void;
    webhookOnCreationURLs: string[];
    webhookOnStatusUpdateEnabled: boolean;
    onToggleWebhookOnStatusUpdate: () => void;
    webhookOnStatusUpdateURLs: string[];
    webhookOnStatusUpdateChange: (url: string) => void;
    messageOnJoinEnabled: boolean;
    onToggleMessageOnJoin: () => void;
    messageOnJoin: string;
    messageOnJoinChange: (message: string) => void;
    exportChannelOnFinishedEnabled: boolean;
    onToggleExportChannelOnFinishedEnabled: () => void;
    signalAnyKeywordsEnabled: boolean;
    onToggleSignalAnyKeywords: () => void;
    signalAnyKeywordsChange: (keywords: string[]) => void;
    signalAnyKeywords: string[];
    categorizePlaybookRun: boolean;
    onToggleCategorizePlaybookRun: () => void;
    categoryName: string;
    categoryNameChange: (categoryName: string) => void;
}

export const AutomationSettings = (props: Props) => {
    return (
        <>
            <Section>
                <SectionTitle>
                    {'Prompt to run the playbook when a user posts a message'}
                </SectionTitle>
                <Setting id={'signal-any-keywords'}>
                    <InputKeywords
                        enabled={props.signalAnyKeywordsEnabled}
                        onToggle={props.onToggleSignalAnyKeywords}
                        textOnToggle={'Containing any of these keywords'}
                        placeholderText={'Add keywords'}
                        keywords={props.signalAnyKeywords}
                        onKeywordsChange={props.signalAnyKeywordsChange}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {'When a run starts'}
                </SectionTitle>
                <Setting id={'invite-users'}>
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
                <Setting id={'assign-owner'}>
                    <AutoAssignOwner
                        enabled={props.defaultOwnerEnabled}
                        onToggle={props.onToggleDefaultOwner}
                        searchProfiles={props.searchProfiles}
                        getProfiles={props.getProfiles}
                        ownerID={props.defaultOwnerID}
                        onAssignOwner={props.onAssignOwner}
                    />
                </Setting>
                <Setting id={'playbook-run-creation__outgoing-webhook'}>
                    <PatternedTextArea
                        enabled={props.webhookOnCreationEnabled}
                        onToggle={props.onToggleWebhookOnCreation}
                        input={props.webhookOnCreationURLs.join('\n')}
                        onChange={props.webhookOnCreationChange}
                        pattern={'https?://.*'}
                        delimiter={'\n'}
                        maxLength={1000}
                        rows={3}
                        placeholderText={'Enter webhook'}
                        textOnToggle={'Send outgoing webhook (One per line)'}
                        errorText={'Invalid webhook URLs'}
                        maxRows={64}
                        maxErrorText={'Invalid entry: the maximum number of webhooks allowed is 64'}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {'When an update is posted'}
                </SectionTitle>
                <Setting id={'broadcast-channels'}>
                    <Broadcast
                        enabled={props.broadcastEnabled}
                        onToggle={props.onToggleBroadcastChannel}
                        channelIds={props.broadcastChannelIds}
                        onChannelsSelected={props.onBroadcastChannelsSelected}
                    />
                </Setting>
                <Setting id={'playbook-run-status-update__outgoing-webhook'}>
                    <PatternedTextArea
                        enabled={props.webhookOnStatusUpdateEnabled}
                        onToggle={props.onToggleWebhookOnStatusUpdate}
                        input={props.webhookOnStatusUpdateURLs.join('\n')}
                        onChange={props.webhookOnStatusUpdateChange}
                        pattern={'https?://.*'}
                        delimiter={'\n'}
                        maxLength={1000}
                        rows={3}
                        placeholderText={'Enter webhook'}
                        textOnToggle={'Send outgoing webhook (One per line)'}
                        errorText={'Invalid webhook URLs'}
                        maxRows={64}
                        maxErrorText={'Invalid entry: the maximum number of webhooks allowed is 64'}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {'When a new member joins the channel'}
                </SectionTitle>
                <Setting id={'user-joins-message'}>
                    <MessageOnJoin
                        enabled={props.messageOnJoinEnabled}
                        onToggle={props.onToggleMessageOnJoin}
                        message={props.messageOnJoin}
                        onChange={props.messageOnJoinChange}
                    />
                </Setting>
                <Setting id={'user-joins-channel-categorize'}>
                    <PatternedInput
                        enabled={props.categorizePlaybookRun}
                        onToggle={props.onToggleCategorizePlaybookRun}
                        input={props.categoryName}
                        onChange={props.categoryNameChange}
                        pattern={'[\\s\\S]*'}
                        placeholderText={'Enter category name'}
                        textOnToggle={'Add the channel to a sidebar category'}
                        type={'text'}
                        errorText={'Invalid category name.'} // this should not happen
                        maxLength={22}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {'When a run is finished'}
                </SectionTitle>
                <Setting id={'export-channel-on-finished'}>
                    <ExportChannelOnArchive
                        enabled={props.exportChannelOnFinishedEnabled}
                        onToggle={props.onToggleExportChannelOnFinishedEnabled}
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
