// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {TabContainer} from 'src/components/backstage/styles';
import {DraftPlaybookWithChecklist, PlaybookWithChecklist} from 'src/types/playbook';
import {Section, SectionTitle, Setting} from 'src/components/backstage/playbook_edit/styles';
import {PatternedInput} from 'src/components/backstage/playbook_edit/automation/patterned_input';
import {InviteUsers} from 'src/components/backstage/playbook_edit/automation/invite_users';
import {AutoAssignOwner} from 'src/components/backstage/playbook_edit/automation/auto_assign_owner';
import {PatternedTextArea} from 'src/components/backstage/playbook_edit/automation/patterned_text_area';
import {Broadcast} from 'src/components/backstage/playbook_edit/automation/broadcast';
import {MessageOnJoin} from 'src/components/backstage/playbook_edit/automation/message_on_join';
import {CategorizePlaybookRun} from 'src/components/backstage/playbook_edit/automation/categorize_playbook_run';
import {InputKeywords} from 'src/components/backstage/playbook_edit/automation/input_keywords';
import RunSummary from 'src/components/backstage/playbook_edit/automation/run_summary';

interface Props {
    playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist;
    setPlaybook: (playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist) => void;
    setChangesMade: (b: boolean) => void;
    searchUsers: (term: string) => ActionFunc;
    getUsers: () => ActionFunc;
}

const ActionsEdit = ({playbook, setPlaybook, setChangesMade, searchUsers, getUsers}: Props) => {
    const {formatMessage} = useIntl();

    const handleSignalAnyKeywordsChange = (keywords: string[]) => {
        setPlaybook({
            ...playbook,
            signal_any_keywords: [...keywords],
        });
        setChangesMade(true);
    };

    const handleToggleSignalAnyKeywords = () => {
        setPlaybook({
            ...playbook,
            signal_any_keywords_enabled: !playbook.signal_any_keywords_enabled,
        });
        setChangesMade(true);
    };

    const handleAddUserInvited = (userId: string) => {
        if (!playbook.invited_user_ids.includes(userId)) {
            setPlaybook({
                ...playbook,
                invited_user_ids: [...playbook.invited_user_ids, userId],
            });
            setChangesMade(true);
        }
    };

    const handleRemoveUserInvited = (userId: string) => {
        const idx = playbook.invited_user_ids.indexOf(userId);
        setPlaybook({
            ...playbook,
            invited_user_ids: [...playbook.invited_user_ids.slice(0, idx), ...playbook.invited_user_ids.slice(idx + 1)],
        });
        setChangesMade(true);
    };

    const handleAssignDefaultOwner = (userId: string | undefined) => {
        if ((userId || userId === '') && playbook.default_owner_id !== userId) {
            setPlaybook({
                ...playbook,
                default_owner_id: userId,
            });
            setChangesMade(true);
        }
    };

    const handleBroadcastChannelSelected = (channelIds: string[]) => {
        // assumes no repeated elements on any of the arrays
        if (channelIds.length !== playbook.broadcast_channel_ids.length || channelIds.some((id) => !playbook.broadcast_channel_ids.includes(id))) {
            setPlaybook({
                ...playbook,
                broadcast_channel_ids: channelIds,
            });
            setChangesMade(true);
        }
    };

    const handleWebhookOnCreationChange = (urls: string) => {
        setPlaybook({
            ...playbook,
            webhook_on_creation_urls: urls.split('\n'),
        });
        setChangesMade(true);
    };

    const handleWebhookOnStatusUpdateChange = (urls: string) => {
        setPlaybook({
            ...playbook,
            webhook_on_status_update_urls: urls.split('\n'),
        });
        setChangesMade(true);
    };

    const handleMessageOnJoinChange = (message: string) => {
        if (playbook.message_on_join !== message) {
            setPlaybook({
                ...playbook,
                message_on_join: message,
            });
            setChangesMade(true);
        }
    };

    const handleToggleMessageOnJoin = () => {
        setPlaybook({
            ...playbook,
            message_on_join_enabled: !playbook.message_on_join_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleInviteUsers = () => {
        setPlaybook({
            ...playbook,
            invite_users_enabled: !playbook.invite_users_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleDefaultOwner = () => {
        setPlaybook({
            ...playbook,
            default_owner_enabled: !playbook.default_owner_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleRunSummary = () => {
        setPlaybook({
            ...playbook,
            run_summary_template_enabled: !playbook.run_summary_template_enabled,
        });
        setChangesMade(true);
    };

    const handleRunSummaryChange = (runSummary: string) => {
        setPlaybook({
            ...playbook,
            run_summary_template: runSummary,
        });
        setChangesMade(true);
    };

    const handleToggleBroadcastChannels = () => {
        setPlaybook({
            ...playbook,
            broadcast_enabled: !playbook.broadcast_enabled && playbook.status_update_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleWebhookOnCreation = () => {
        setPlaybook({
            ...playbook,
            webhook_on_creation_enabled: !playbook.webhook_on_creation_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleWebhookOnStatusUpdate = () => {
        setPlaybook({
            ...playbook,
            webhook_on_status_update_enabled: !playbook.webhook_on_status_update_enabled && playbook.status_update_enabled,
        });
        setChangesMade(true);
    };

    const handleToggleCategorizePlaybookRun = () => {
        setPlaybook({
            ...playbook,
            categorize_channel_enabled: !playbook.categorize_channel_enabled,
        });
        setChangesMade(true);
    };

    const handleCategoryNameChange = (name: string) => {
        if (playbook.category_name !== name) {
            setPlaybook({
                ...playbook,
                category_name: name,
            });
            setChangesMade(true);
        }
    };

    const handleChannelNameTemplateChange = (channelNameTemplate: string) => {
        setPlaybook({
            ...playbook,
            channel_name_template: channelNameTemplate,
        });
        setChangesMade(true);
    };

    return (
        <TabContainer>
            <Section>
                <SectionTitle>
                    {formatMessage({defaultMessage: 'Prompt to run the playbook when a user posts a message'})}
                </SectionTitle>
                <Setting id={'signal-any-keywords'}>
                    <InputKeywords
                        enabled={playbook.signal_any_keywords_enabled}
                        onToggle={handleToggleSignalAnyKeywords}
                        textOnToggle={formatMessage({defaultMessage: 'Containing any of these keywords'})}
                        placeholderText={formatMessage({defaultMessage: 'Add keywords'})}
                        keywords={playbook.signal_any_keywords}
                        onKeywordsChange={handleSignalAnyKeywordsChange}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {formatMessage({defaultMessage: 'When a run starts'})}
                </SectionTitle>
                <Setting id={'create-channel'}>
                    <PatternedInput
                        enabled={true}
                        disableToggle={true}
                        onToggle={() => null}
                        input={playbook.channel_name_template}
                        onChange={handleChannelNameTemplateChange}
                        pattern={'[\\S][\\s\\S]*[\\S]'} // at least two non-whitespace characters
                        placeholderText={formatMessage({defaultMessage: 'Channel name template (optional)'})}
                        textOnToggle={formatMessage({defaultMessage: 'Create a channel'})}
                        type={'text'}
                        errorText={formatMessage({defaultMessage: 'Channel name is not valid.'})}
                    />
                </Setting>
                <Setting id={'invite-users'}>
                    <InviteUsers
                        enabled={playbook.invite_users_enabled}
                        onToggle={handleToggleInviteUsers}
                        searchProfiles={searchUsers}
                        getProfiles={getUsers}
                        userIds={playbook.invited_user_ids}
                        onAddUser={handleAddUserInvited}
                        onRemoveUser={handleRemoveUserInvited}
                    />
                </Setting>
                <Setting id={'assign-owner'}>
                    <AutoAssignOwner
                        enabled={playbook.default_owner_enabled}
                        onToggle={handleToggleDefaultOwner}
                        searchProfiles={searchUsers}
                        getProfiles={getUsers}
                        ownerID={playbook.default_owner_id}
                        onAssignOwner={handleAssignDefaultOwner}
                    />
                </Setting>
                <Setting id={'run-summary'}>
                    <RunSummary
                        enabled={playbook.run_summary_template_enabled}
                        onToggle={handleToggleRunSummary}
                        summary={playbook.run_summary_template}
                        onSummaryChanged={handleRunSummaryChange}
                    />
                </Setting>
                <Setting id={'playbook-run-creation__outgoing-webhook'}>
                    <PatternedTextArea
                        enabled={playbook.webhook_on_creation_enabled}
                        onToggle={handleToggleWebhookOnCreation}
                        input={playbook.webhook_on_creation_urls.join('\n')}
                        onChange={handleWebhookOnCreationChange}
                        pattern={'https?://.*'}
                        delimiter={'\n'}
                        maxLength={1000}
                        rows={3}
                        placeholderText={formatMessage({defaultMessage: 'Enter webhook'})}
                        textOnToggle={formatMessage({defaultMessage: 'Send outgoing webhook (One per line)'})}
                        errorText={formatMessage({defaultMessage: 'Invalid webhook URLs'})}
                        maxRows={64}
                        maxErrorText={formatMessage({defaultMessage: 'Invalid entry: the maximum number of webhooks allowed is 64'})}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {formatMessage({defaultMessage: 'When an update is posted'})}
                </SectionTitle>
                <Setting id={'broadcast-channels'}>
                    <Broadcast
                        enabled={playbook.broadcast_enabled && playbook.status_update_enabled}
                        onToggle={handleToggleBroadcastChannels}
                        channelIds={playbook.broadcast_channel_ids}
                        onChannelsSelected={handleBroadcastChannelSelected}
                    />
                </Setting>
                <Setting id={'playbook-run-status-update__outgoing-webhook'}>
                    <PatternedTextArea
                        enabled={playbook.webhook_on_status_update_enabled && playbook.status_update_enabled}
                        onToggle={handleToggleWebhookOnStatusUpdate}
                        input={playbook.webhook_on_status_update_urls.join('\n')}
                        onChange={handleWebhookOnStatusUpdateChange}
                        pattern={'https?://.*'}
                        delimiter={'\n'}
                        maxLength={1000}
                        rows={3}
                        placeholderText={formatMessage({defaultMessage: 'Enter webhook'})}
                        textOnToggle={formatMessage({defaultMessage: 'Send outgoing webhook (One per line)'})}
                        errorText={formatMessage({defaultMessage: 'Invalid webhook URLs'})}
                        maxRows={64}
                        maxErrorText={formatMessage({defaultMessage: 'Invalid entry: the maximum number of webhooks allowed is 64'})}
                    />
                </Setting>
            </Section>
            <Section>
                <SectionTitle>
                    {formatMessage({defaultMessage: 'When a new member joins the channel'})}
                </SectionTitle>
                <Setting id={'user-joins-message'}>
                    <MessageOnJoin
                        enabled={playbook.message_on_join_enabled}
                        onToggle={handleToggleMessageOnJoin}
                        message={playbook.message_on_join}
                        onChange={handleMessageOnJoinChange}
                    />
                </Setting>
                <Setting id={'user-joins-channel-categorize'}>
                    <CategorizePlaybookRun
                        enabled={playbook.categorize_channel_enabled}
                        onToggle={handleToggleCategorizePlaybookRun}
                        categoryName={playbook.category_name}
                        onCategorySelected={handleCategoryNameChange}
                    />
                </Setting>
            </Section>
        </TabContainer>
    );
};

export default ActionsEdit;
