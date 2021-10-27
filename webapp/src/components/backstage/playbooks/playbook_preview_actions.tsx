// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';
import {useIntl} from 'react-intl';

import {useDefaultMarkdownOptionsByTeamId} from 'src/hooks/general';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {messageHtmlToComponent, formatText} from 'src/webapp_globals';

import {TextBadge, ChannelBadge} from 'src/components/backstage/playbooks/playbook_preview_badges';
import {Card, CardEntry, CardSubEntry} from 'src/components/backstage/playbooks/playbook_preview_cards';
import Section from 'src/components/backstage/playbooks/playbook_preview_section';
import ProfileSelector from 'src/components/profile/profile_selector';
import {UserList} from 'src/components/rhs/rhs_participants';

interface Props {
    playbook: PlaybookWithChecklist;
}

const PlaybookPreviewActions = (props: Props) => {
    const {formatMessage} = useIntl();
    const markdownOptions = useDefaultMarkdownOptionsByTeamId(props.playbook.team_id);
    const renderMarkdown = (msg: string) => messageHtmlToComponent(formatText(msg, markdownOptions), true, {});

    // The following booleans control the rendering of each of the CardEntry components in this section,
    // hiding them if they don't have any visible subentries.
    // If a new CardSubEntry is added or the conditions are changed, these booleans need to be updated.

    const emptyPromptEntry =
        !props.playbook.signal_any_keywords_enabled;

    const emptyRunStartEntry =
        !props.playbook.invite_users_enabled &&
        !props.playbook.default_owner_enabled &&
        !props.playbook.broadcast_enabled &&
        !props.playbook.webhook_on_status_update_enabled &&
        !props.playbook.webhook_on_creation_enabled;

    const emptyNewMemberEntry =
        !props.playbook.message_on_join_enabled &&
        !props.playbook.categorize_channel_enabled;

    const emptyRunFinishEntry =
        !props.playbook.export_channel_on_finished_enabled;

    const allEmpty =
        emptyPromptEntry &&
        emptyRunStartEntry &&
        emptyNewMemberEntry &&
        emptyRunFinishEntry;

    if (allEmpty) {
        return null;
    }

    return (
        <Section title={formatMessage({defaultMessage: 'Actions'})}>
            <Card>
                <CardEntry
                    title={formatMessage({
                        defaultMessage: 'Prompt to run this playbook when a user posts a message containing the keywords',
                    })}
                    iconName={'message-text-outline'}
                    extraInfo={props.playbook.signal_any_keywords.map((keyword) => (
                        <TextBadge key={keyword}>{keyword}</TextBadge>
                    ))}
                    enabled={!emptyPromptEntry}
                />
                <CardEntry
                    title={formatMessage({
                        defaultMessage: 'When a run starts',
                    })}
                    iconName={'play'}
                    enabled={!emptyRunStartEntry}
                >
                    <CardSubEntry
                        title={formatMessage(
                            {defaultMessage: 'Create a {isPublic, select, true {public} other {private}} channel'},
                            {isPublic: props.playbook.create_public_playbook_run},
                        )}
                        enabled={true}
                    />
                    <CardSubEntry
                        title={formatMessage(
                            {defaultMessage: 'Invite {numInvitedUsers, plural, =0 {no members} =1 {one member} other {# members}} to the channel'},
                            {numInvitedUsers: props.playbook.invited_user_ids.length}
                        )}
                        extraInfo={(
                            <UserRow>
                                <UserList
                                    userIds={props.playbook.invited_user_ids}
                                    sizeInPx={20}
                                />
                            </UserRow>
                        )}
                        enabled={props.playbook.invite_users_enabled}
                    />
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage: 'Assign the owner role to',
                        })}
                        enabled={props.playbook.default_owner_enabled}
                        extraInfo={(
                            <StyledProfileSelector
                                selectedUserId={props.playbook.default_owner_id}
                                placeholder={null}
                                placeholderButtonClass={'NoAssignee-button'}
                                profileButtonClass={'Assigned-button'}
                                enableEdit={false}
                                getUsers={() => Promise.resolve([])}
                            />
                        )}
                    />
                    <CardSubEntry
                        title={formatMessage(
                            {defaultMessage: 'Announce in the {oneChannel, plural, one {channel} other {channels}}'},
                            {oneChannel: props.playbook.broadcast_channel_ids.length}
                        )}
                        enabled={props.playbook.broadcast_enabled}
                        extraInfo={props.playbook.broadcast_channel_ids.map((id) => (
                            <ChannelBadge
                                key={id}
                                channelId={id}
                            />
                        ))}
                    />
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage: 'Update run summary',
                        })}
                        enabled={props.playbook.webhook_on_status_update_enabled}
                    >
                        {renderMarkdown(props.playbook.reminder_message_template)}
                    </CardSubEntry>
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage: 'Send an outgoing webhook',
                        })}
                        enabled={props.playbook.webhook_on_creation_enabled}
                    >
                        {props.playbook.webhook_on_creation_urls.map((url) => (<p key={url}>{url}</p>))}
                    </CardSubEntry>
                </CardEntry>
                <CardEntry
                    title={formatMessage({defaultMessage: 'When a new member joins the channel'})}
                    iconName={'account-outline'}
                    enabled={!emptyNewMemberEntry}
                >
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage: 'Send a welcome message',
                        })}
                        enabled={props.playbook.message_on_join_enabled}
                    >
                        {renderMarkdown(props.playbook.message_on_join)}
                    </CardSubEntry>
                    <CardSubEntry
                        title={formatMessage({defaultMessage: 'Add the channel to the sidebar category'})}
                        enabled={props.playbook.categorize_channel_enabled}
                        extraInfo={(
                            <TextBadge>
                                {props.playbook.category_name}
                            </TextBadge>
                        )}
                    />
                </CardEntry>
                <CardEntry
                    title={formatMessage({defaultMessage: 'When a run is finished, export the channel'})}
                    iconName={'flag-outline'}
                    enabled={emptyRunFinishEntry}
                />
            </Card>
        </Section>
    );
};

const StyledProfileSelector = styled(ProfileSelector)`
    margin-top: 0;
    height: 20px;

    .Assigned-button {
        border-radius: 16px;
        max-width: 100%;
        height: 20px;
        padding: 2px;
        padding-right: 6px;
        margin-top: 0;
        background: var(--center-channel-color-08);

        :hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
        }

        .image {
            width: 16px;
            height: 16px;
        }

        font-weight: 600;
        font-size: 11px;
        line-height: 16px;

        display: flex;
        align-items: center;

    }

    .name {
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

const UserRow = styled.div`
    display: flex;
    flex-direction: row;
`;

export default PlaybookPreviewActions;
