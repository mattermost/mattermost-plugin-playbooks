// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import styled from 'styled-components';

import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import MarkdownEdit from 'src/components/markdown_edit';

import BroadcastChannels from './inputs/broadcast_channels_selector';
import UpdateTimer from './inputs/update_timer_selector';
import WebhooksInput from './inputs/webhooks_input';

interface Props {
    playbook: Loaded<FullPlaybook>;
}

const StatusUpdates = ({playbook}: Props) => {
    const {formatMessage} = useIntl();
    const updatePlaybook = useUpdatePlaybook(playbook.id);

    if (!playbook.status_update_enabled) {
        return (
            <StatusUpdatesContainer>
                <FormattedMessage defaultMessage='Status updates are not expected.'/>
            </StatusUpdatesContainer>
        );
    }

    return (
        <StatusUpdatesContainer>
            <FormattedMessage
                defaultMessage='A status update is expected every <duration></duration>. New updates will be posted to <channels>{channelCount, plural, =0 {no channels} one {# channel} other {# channels}}</channels> and <webhooks>{webhookCount, plural, =0 {no outgoing webhooks} one {# outgoing webhook} other {# outgoing webhooks}}</webhooks> .'
                values={{
                    duration: () => {
                        return (
                            <Picker>
                                <UpdateTimer
                                    seconds={playbook.reminder_timer_default_seconds}
                                    setSeconds={(seconds: number) => {
                                        if (
                                            seconds !== playbook.reminder_timer_default_seconds &&
                                            seconds > 0
                                        ) {
                                            updatePlaybook({
                                                reminderTimerDefaultSeconds: seconds,
                                            });
                                        }
                                    }}
                                />
                            </Picker>
                        );
                    },
                    channelCount: playbook.broadcast_channel_ids?.length ?? 0,
                    channels: (channelCount: ReactNode) => {
                        return (
                            <Picker>
                                <BroadcastChannels
                                    id='playbook-automation-broadcast'
                                    onChannelsSelected={(channelIds: string[]) => {
                                        if (
                                            channelIds.length !== playbook.broadcast_channel_ids.length ||
                                            channelIds.some((id) => !playbook.broadcast_channel_ids.includes(id))
                                        ) {
                                            updatePlaybook({
                                                broadcastChannelIDs: channelIds,
                                            });
                                        }
                                    }}
                                    channelIds={playbook.broadcast_channel_ids}
                                >
                                    <Placeholder label={channelCount}/>
                                </BroadcastChannels>
                            </Picker>
                        );
                    },
                    webhookCount: playbook.webhook_on_status_update_urls?.length ?? 0,
                    webhooks: (webhookCount: ReactNode) => {
                        return (
                            <Picker>
                                <WebhooksInput
                                    urls={playbook.webhook_on_status_update_urls}
                                    onChange={(newWebhookOnStatusUpdateURLs: string[]) => {
                                        if (newWebhookOnStatusUpdateURLs.length === 0) {
                                            updatePlaybook({
                                                webhookOnStatusUpdateEnabled: false,
                                                webhookOnStatusUpdateURLs: [],
                                            });
                                        } else {
                                            updatePlaybook({
                                                webhookOnStatusUpdateEnabled: true,
                                                webhookOnStatusUpdateURLs: newWebhookOnStatusUpdateURLs,
                                            });
                                        }
                                    }}
                                >
                                    <Placeholder label={webhookCount}/>
                                </WebhooksInput>
                            </Picker>
                        );
                    },
                }}
            />
            <Template>
                <MarkdownEdit
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
    font-weight: 400;
    font-size: 14px;
    line-height: 2.5rem;
    color: var(--center-channel-color-72);
`;

const Picker = styled.span`
    display: inline-block;
    color: var(--button-bg);
    background: rgba(var(--button-bg-rgb), 0.08);
    border-radius: 12px;
    line-height: 15px;
    padding: 3px 3px 3px 10px;
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
    align-items: center;
    flex-direction: row;
    white-space: nowrap;

    &:hover {
        cursor: pointer;
    }
`;

const SelectorRightIcon = styled.i`
    font-size: 14.4px;
    &{
        margin-left: 4px;
    }
    color: var(--center-channel-color-32);
`;

const TextContainer = styled.span`
    font-weight: 600;
    font-size: 13px;
`;

export default StatusUpdates;
