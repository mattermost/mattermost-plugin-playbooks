// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {useDispatch} from 'react-redux';

import {getProfilesInTeam, searchProfiles} from 'mattermost-redux/actions/users';

import styled from 'styled-components';

import Icon from '@mdi/react';
import {mdiPlay, mdiFlagOutline, mdiAccountCheckOutline} from '@mdi/js';

import {TabContainer} from 'src/components/backstage/styles';
import {DraftPlaybookWithChecklist, PlaybookWithChecklist} from 'src/types/playbook';
import {Section, SectionTitle, Setting} from 'src/components/backstage/playbook_edit/styles';
import {InviteUsers} from 'src/components/backstage/playbook_edit/automation/invite_users';
import {AutoAssignOwner} from 'src/components/backstage/playbook_edit/automation/auto_assign_owner';
import {WebhookSetting} from 'src/components/backstage/playbook_edit/automation/webhook_setting';
import {MessageOnJoin} from 'src/components/backstage/playbook_edit/automation/message_on_join';
import {CategorizePlaybookRun} from 'src/components/backstage/playbook_edit/automation/categorize_playbook_run';
import RunSummary from 'src/components/backstage/playbook_edit/automation/run_summary';
import {CreateAChannel} from 'src/components/backstage/playbook_edit/automation/channel_access';
import {ErrorPageTypes, PROFILE_CHUNK_SIZE} from 'src/constants';
import {PlaybookReadWriteProps} from '../playbook_editor';

const LegacyActionsEdit = ({playbook, updatePlaybook}: PlaybookReadWriteProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: playbook.team_id}));
    };

    const getUsers = () => {
        return dispatch(getProfilesInTeam(playbook.team_id, 0, PROFILE_CHUNK_SIZE, '', {active: true}));
    };

    const handleAddUserInvited = (userId: string) => {
        if (!playbook.invited_user_ids.includes(userId)) {
            updatePlaybook({
                invited_user_ids: [...playbook.invited_user_ids, userId],
            });
        }
    };

    const handleRemoveUserInvited = (userId: string) => {
        const idx = playbook.invited_user_ids.indexOf(userId);
        updatePlaybook({
            invited_user_ids: [...playbook.invited_user_ids.slice(0, idx), ...playbook.invited_user_ids.slice(idx + 1)],
        });
    };

    const handleAssignDefaultOwner = (userId: string | undefined) => {
        if ((userId || userId === '') && playbook.default_owner_id !== userId) {
            updatePlaybook({
                default_owner_id: userId,
            });
        }
    };

    const handleWebhookOnCreationChange = (urls: string) => {
        updatePlaybook({
            webhook_on_creation_urls: urls.split('\n'),
        });
    };

    const handleMessageOnJoinChange = (message: string) => {
        if (playbook.message_on_join !== message) {
            updatePlaybook({
                ...playbook,
                message_on_join: message,
            });
        }
    };

    const handleToggleMessageOnJoin = () => {
        updatePlaybook({
            message_on_join_enabled: !playbook.message_on_join_enabled,
        });
    };

    const handleToggleInviteUsers = () => {
        updatePlaybook({
            invite_users_enabled: !playbook.invite_users_enabled,
        });
    };

    const handleToggleDefaultOwner = () => {
        updatePlaybook({
            default_owner_enabled: !playbook.default_owner_enabled,
        });
    };

    const handleToggleRunSummary = () => {
        updatePlaybook({
            ...playbook,
            run_summary_template_enabled: !playbook.run_summary_template_enabled,
        });
    };

    const handleRunSummaryChange = (runSummary: string) => {
        updatePlaybook({
            run_summary_template: runSummary,
        });
    };

    const handleToggleWebhookOnCreation = () => {
        updatePlaybook({
            webhook_on_creation_enabled: !playbook.webhook_on_creation_enabled,
        });
    };

    const handleToggleCategorizePlaybookRun = () => {
        updatePlaybook({
            categorize_channel_enabled: !playbook.categorize_channel_enabled,
        });
    };

    const handleCategoryNameChange = (name: string) => {
        if (playbook.category_name !== name) {
            updatePlaybook({
                ...playbook,
                category_name: name,
            });
        }
    };

    return (
        <>
            <StyledSection>
                <StyledSectionTitle>
                    <Icon
                        path={mdiPlay}
                        size={1.75}
                    />
                    <FormattedMessage defaultMessage='When a run starts'/>
                </StyledSectionTitle>
                <Setting id={'create-channel'}>
                    <CreateAChannel
                        playbook={playbook}
                        setPlaybook={({
                            create_public_playbook_run,
                            channel_name_template,
                        }) => {
                            updatePlaybook({
                                create_public_playbook_run,
                                channel_name_template,
                            });
                        }}
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
                <Setting id={'playbook-run-creation__outgoing-webhook'}>
                    <WebhookSetting
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
            </StyledSection>
            <StyledSection>
                <StyledSectionTitle>
                    <Icon
                        path={mdiAccountCheckOutline}
                        size={1.75}
                    />
                    <FormattedMessage defaultMessage='When a new member joins the channel'/>
                </StyledSectionTitle>
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
            </StyledSection>
        </>
    );
};

export default LegacyActionsEdit;

const StyledSection = styled(Section)`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 2rem;
    margin: 0;
    margin-bottom: 20px;
    border-radius: 8px;
`;

const StyledSectionTitle = styled(SectionTitle)`
    font-weight: 600;
    margin: 0 0 24px;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    svg {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
`;
