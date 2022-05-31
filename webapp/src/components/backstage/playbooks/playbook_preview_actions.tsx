// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';
import {useIntl} from 'react-intl';

import FormattedMarkdown, {useDefaultMarkdownOptions} from 'src/components/formatted_markdown';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {messageHtmlToComponent, formatText} from 'src/webapp_globals';

import {EllipsizedText, TextBadge, ChannelBadge} from 'src/components/backstage/playbooks/playbook_preview_badges';
import {Card, CardEntry, CardSubEntry} from 'src/components/backstage/playbooks/playbook_preview_cards';
import Section from 'src/components/backstage/playbooks/playbook_preview_section';
import ProfileSelector from 'src/components/profile/profile_selector';
import {UserList} from 'src/components/rhs/rhs_participants';
import Tooltip from 'src/components/widgets/tooltip';

interface Props {
    id: string;
    playbook: PlaybookWithChecklist;
    followerIds: string[];
}

const PlaybookPreviewActions = (props: Props) => {
    const {formatMessage} = useIntl();

    // The following booleans control the rendering of each of the CardEntry components in this section,
    // hiding them if they don't have any visible subentries.
    // If a new CardSubEntry is added or the conditions are changed, these booleans need to be updated.

    const createChannelEnabled = true;
    const autofollowsEnabled = props.followerIds.length > 0;
    const inviteUsersEnabled = props.playbook.invite_users_enabled && props.playbook.invited_user_ids.length !== 0;
    const defaultOwnerEnabled = props.playbook.default_owner_enabled && props.playbook.default_owner_id !== '';
    const broadcastEnabled = props.playbook.broadcast_enabled && props.playbook.broadcast_channel_ids.length !== 0;
    const runSummaryEnabled = props.playbook.run_summary_template !== '';
    const webhookOnCreationEnabled = props.playbook.webhook_on_creation_enabled && props.playbook.webhook_on_creation_urls.length !== 0;

    const showRunStartCardEntry =
        createChannelEnabled ||
        inviteUsersEnabled ||
        broadcastEnabled ||
        defaultOwnerEnabled ||
        runSummaryEnabled ||
        webhookOnCreationEnabled ||
        autofollowsEnabled;

    const messageOnJoinEnabled = props.playbook.message_on_join_enabled && props.playbook.message_on_join !== '';
    const categorizeChannelEnabled = props.playbook.categorize_channel_enabled && props.playbook.category_name !== '';

    const showNewMemberCardEntry =
        messageOnJoinEnabled ||
        categorizeChannelEnabled;

    const allCardEntriesEmpty =
        !showRunStartCardEntry &&
        !showNewMemberCardEntry;

    if (allCardEntriesEmpty) {
        return null;
    }

    return (
        <Section
            id={props.id}
            title={formatMessage({defaultMessage: 'Actions'})}
        >
            <Card data-testid='playbook-preview-actions'>
                <CardEntry
                    title={formatMessage({
                        defaultMessage: 'When a run starts',
                    })}
                    iconName={'play'}
                    enabled={showRunStartCardEntry}
                >
                    <CardSubEntry
                        title={formatMessage(
                            {defaultMessage: 'Create a {isPublic, select, true {public} other {private}} channel'},
                            {isPublic: props.playbook.create_public_playbook_run},
                        )}
                        enabled={true}
                        extraInfo={props.playbook.channel_name_template && (
                            <TextBadge>
                                {props.playbook.channel_name_template}
                            </TextBadge>
                        )}
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
                        enabled={inviteUsersEnabled}
                    />
                    <CardSubEntry
                        title={formatMessage(
                            {defaultMessage: 'Begin following for {followers, plural, =1 {one user} other {# users}}'},
                            {followers: props.followerIds.length}
                        )}
                        extraInfo={(
                            <UserRow>
                                <UserList
                                    userIds={props.followerIds}
                                    sizeInPx={20}
                                />
                            </UserRow>
                        )}
                        enabled={autofollowsEnabled}
                    />
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage: 'Assign the owner role to',
                        })}
                        enabled={defaultOwnerEnabled}
                        extraInfo={(
                            <StyledProfileSelector
                                selectedUserId={props.playbook.default_owner_id}
                                placeholder={null}
                                placeholderButtonClass={'NoAssignee-button'}
                                profileButtonClass={'Assigned-button'}
                                enableEdit={false}
                                getUsers={() => Promise.resolve([])}
                                getUsersInTeam={() => Promise.resolve([])}
                            />
                        )}
                    />
                    <CardSubEntry
                        title={formatMessage(
                            {defaultMessage: 'Announce in the {oneChannel, plural, one {channel} other {channels}}'},
                            {oneChannel: props.playbook.broadcast_channel_ids.length}
                        )}
                        enabled={broadcastEnabled}
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
                        enabled={runSummaryEnabled}
                    >
                        <FormattedMarkdown value={props.playbook.run_summary_template}/>
                    </CardSubEntry>
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage: 'Send an outgoing webhook',
                        })}
                        enabled={webhookOnCreationEnabled}
                    >
                        {props.playbook.webhook_on_creation_urls.map((url) => (<p key={url}>{url}</p>))}
                    </CardSubEntry>
                </CardEntry>
                <CardEntry
                    title={formatMessage({defaultMessage: 'When a new member joins the channel'})}
                    iconName={'account-outline'}
                    enabled={showNewMemberCardEntry}
                >
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage: 'Send a welcome message',
                        })}
                        enabled={messageOnJoinEnabled}
                    >
                        <FormattedMarkdown value={props.playbook.message_on_join}/>
                    </CardSubEntry>
                    <CardSubEntry
                        title={formatMessage({defaultMessage: 'Add the channel to the sidebar category'})}
                        enabled={categorizeChannelEnabled}
                        extraInfo={(
                            <TextBadge>
                                {props.playbook.category_name}
                            </TextBadge>
                        )}
                    />
                </CardEntry>
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
        background: rgba(var(--center-channel-color-rgb), 0.08);

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

const KeywordsExtraInfo = ({keywords}: {keywords: string[]}) => {
    const {formatMessage} = useIntl();

    if (keywords.length === 1) {
        return (
            <Tooltip
                id={'playbook-preview-actions-keywords-extra-info'}
                content={keywords[0]}
            >
                <ShortTextBadge>
                    <EllipsizedText>{keywords[0]}</EllipsizedText>
                </ShortTextBadge>
            </Tooltip>
        );
    }

    return (
        <Tooltip
            id={'playbook-preview-actions-keywords-extra-info'}
            content={keywords.join(', ')}
        >
            <TextBadge>
                {formatMessage(
                    {defaultMessage: '{numKeywords, plural, other {# keywords}}'},
                    {numKeywords: keywords.length},
                )}
            </TextBadge>
        </Tooltip>
    );
};

const ShortTextBadge = styled(TextBadge)`
    max-width: 150px;
`;

export default PlaybookPreviewActions;
