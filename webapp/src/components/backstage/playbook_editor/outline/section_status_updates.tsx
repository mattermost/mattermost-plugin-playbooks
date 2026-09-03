// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import styled from 'styled-components';

import {Duration} from 'luxon';

import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import MarkdownEdit from 'src/components/markdown_edit';

import {formatDuration} from 'src/components/formatted_duration';

import BroadcastChannels from './inputs/broadcast_channels_selector';
import UpdateTimer from './inputs/update_timer_selector';
import WebhooksInput from './inputs/webhooks_input';

interface Props {
    playbook: Loaded<FullPlaybook>;
    canEdit?: boolean;
}

const StatusUpdates = ({playbook, canEdit = true}: Props) => {
    const {formatMessage} = useIntl();
    const updatePlaybook = useUpdatePlaybook(playbook.id);
    const archived = playbook.delete_at !== 0;
    const disabled = archived || !canEdit;

    if (!playbook.status_update_enabled) {
        return (
            <StatusUpdatesContainer>
                <StatusUpdatesTextContainer>
                    <FormattedMessage defaultMessage='Status updates are not expected.'/>
                </StatusUpdatesTextContainer>
            </StatusUpdatesContainer>
        );
    }

    const noReminder = playbook.reminder_timer_default_seconds === 0;

    const durationValue = () => {
        if (disabled) {
            if (noReminder) {
                return formatMessage({defaultMessage: 'never'});
            }
            return formatDuration(Duration.fromDurationLike({seconds: playbook.reminder_timer_default_seconds}), 'long');
        }
        return (
            <Picker data-testid={'status-update-timer'}>
                <UpdateTimer
                    seconds={playbook.reminder_timer_default_seconds}
                    setSeconds={(seconds: number) => {
                        if (
                            seconds !== playbook.reminder_timer_default_seconds &&
                            seconds >= 0
                        ) {
                            updatePlaybook({
                                reminderTimerDefaultSeconds: seconds,
                            });
                        }
                    }}
                />
            </Picker>
        );
    };

    // if the broadcast is disabled, we broadcast update to zero channel
    const channelCount = playbook.broadcast_enabled ? playbook.broadcast_channel_ids?.length ?? 0 : 0;
    const channelsValue = (count: ReactNode) => {
        if (disabled) {
            return count;
        }
        return (
            <Picker data-testid={'status-update-broadcast-channels'}>
                <BroadcastChannels
                    id='playbook-automation-broadcast'
                    onChannelsSelected={(channelIds: string[]) => {
                        if (
                            channelIds.length !== playbook.broadcast_channel_ids.length ||
                            channelIds.some((id) => !playbook.broadcast_channel_ids.includes(id))
                        ) {
                            updatePlaybook({
                                broadcastChannelIDs: channelIds,

                                // We need this to handle cases when StatusUpdate is enabled, but broadcast is disabled. On edit of the channels list, we should enable broadcast.
                                broadcastEnabled: true,
                            });
                        }
                    }}
                    channelIds={playbook.broadcast_channel_ids}
                    broadcastEnabled={playbook.broadcast_enabled}
                >
                    <Placeholder label={count}/>
                </BroadcastChannels>
            </Picker>
        );
    };

    // if the broadcast is disabled, we make zero webhook call
    const webhookCount = playbook.webhook_on_status_update_enabled ? playbook.webhook_on_status_update_urls?.length ?? 0 : 0;
    const webhooksValue = (count: ReactNode) => {
        if (disabled) {
            return count;
        }
        return (
            <Picker data-testid={'status-update-webhooks'}>
                <WebhooksInput
                    urls={playbook.webhook_on_status_update_urls}
                    onChange={(newWebhookOnStatusUpdateURLs: string[]) => {
                        return updatePlaybook({
                            webhookOnStatusUpdateEnabled: true,
                            webhookOnStatusUpdateURLs: newWebhookOnStatusUpdateURLs,
                        });
                    }}
                    webhooksDisabled={!playbook.webhook_on_status_update_enabled}
                >
                    <Placeholder label={count}/>
                </WebhooksInput>
            </Picker>
        );
    };

    return (
        <StatusUpdatesContainer data-testid={'status-update-section'}>
            <StatusUpdatesTextContainer>
                {noReminder ? (
                    <FormattedMessage
                        defaultMessage='A status update is <duration></duration> expected. New updates will be posted to <channels>{channelCount, plural, =0 {no channels} one {# channel} other {# channels}}</channels> and <webhooks>{webhookCount, plural, =0 {no outgoing webhooks} one {# outgoing webhook} other {# outgoing webhooks}}</webhooks>.'
                        values={{
                            duration: durationValue,
                            channelCount,
                            channels: channelsValue,
                            webhookCount,
                            webhooks: webhooksValue,
                        }}
                    />
                ) : (
                    <FormattedMessage
                        defaultMessage='A status update is expected every <duration></duration>. New updates will be posted to <channels>{channelCount, plural, =0 {no channels} one {# channel} other {# channels}}</channels> and <webhooks>{webhookCount, plural, =0 {no outgoing webhooks} one {# outgoing webhook} other {# outgoing webhooks}}</webhooks>.'
                        values={{
                            duration: durationValue,
                            channelCount,
                            channels: channelsValue,
                            webhookCount,
                            webhooks: webhooksValue,
                        }}
                    />
                )}
            </StatusUpdatesTextContainer>
            <Template>
                <MarkdownEdit
                    disabled={disabled}
                    placeholder={formatMessage({defaultMessage: 'Add a status update template…'})}
                    value={playbook.reminder_message_template}
                    onSave={(newMessage: string) => {
                        updatePlaybook({
                            reminderMessageTemplate: newMessage,
                        });
                    }}
                />
            </Template>
        </StatusUpdatesContainer>
    );
};

const StatusUpdatesContainer = styled.div`
    color: var(--center-channel-color-72);
    font-size: 14px;
    font-weight: 400;
    line-height: 2.5rem;
`;

const StatusUpdatesTextContainer = styled.div`
    padding: 0 8px;
`;

const Picker = styled.span`
    display: inline-block;
    padding: 3px 3px 3px 10px;
    border-radius: 12px;
    background: rgba(var(--button-bg-rgb), 0.08);
    color: var(--button-bg);
    line-height: 15px;
`;

const Template = styled.div`
    margin-top: 16px;
`;

interface PlaceholderProps {
    label: React.ReactNode
}
export const Placeholder = (props: PlaceholderProps) => {
    return (
        <PlaceholderDiv>
            <TextContainer>
                {props.label}
            </TextContainer>
            <SelectorRightIcon className='icon-chevron-down icon-12'/>
        </PlaceholderDiv>
    );
};

const PlaceholderDiv = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    white-space: nowrap;

    &:hover {
        cursor: pointer;
    }
`;

const SelectorRightIcon = styled.i`

    color: var(--center-channel-color-32);
    font-size: 14.4px;

    &{
        margin-left: 4px;
    }
`;

const TextContainer = styled.span`
    font-size: 13px;
    font-weight: 600;
`;

export default StatusUpdates;
