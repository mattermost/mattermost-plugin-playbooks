// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import UpdateTimer from 'src/components/backstage/playbook_editor/outline/update_timer_selector';
import TextEdit from 'src/components/text_edit';
import {PlaybookWithChecklist} from 'src/types/playbook';

import BroadcastChannels from './broadcast_channels_selector';
import WebhooksInput from './webhooks_input';
interface Props {
    playbook: PlaybookWithChecklist;
    updatePlaybook: (newPlaybook: PlaybookWithChecklist) => void;
}

const StatusUpdates = (props: Props) => {
    const {formatMessage} = useIntl();

    const disabledStatusUpdate = (
        <>
            {formatMessage({defaultMessage: 'Status updates are not expected.'})}
        </>
    );

    let updateComponent = disabledStatusUpdate;
    if (props.playbook.status_update_enabled) {
        updateComponent = (
            <>
                <Details>
                    <DetailsText>
                        {formatMessage({defaultMessage: 'A status update is expected every'})}
                    </DetailsText>
                    <Picker>
                        <UpdateTimer
                            seconds={props.playbook.reminder_timer_default_seconds}
                            setSeconds={(seconds: number) => {
                                if (seconds !== props.playbook.reminder_timer_default_seconds &&
                                    seconds > 0) {
                                    props.updatePlaybook({
                                        ...props.playbook,
                                        reminder_timer_default_seconds: seconds,
                                    });
                                }
                            }}
                        />
                    </Picker>
                    <DetailsText>
                        {formatMessage({defaultMessage: '.'})}
                    </DetailsText>
                    <div>&nbsp;</div>
                    <DetailsText>
                        {formatMessage({defaultMessage: 'New updates will be posted to'})}
                    </DetailsText>
                    <Picker>
                        <BroadcastChannels
                            id='playbook-automation-broadcast'
                            onChannelsSelected={(channelIds: string[]) => {
                                if (channelIds.length !== props.playbook.broadcast_channel_ids.length || channelIds.some((id) => !props.playbook.broadcast_channel_ids.includes(id))) {
                                    props.updatePlaybook({
                                        ...props.playbook,
                                        broadcast_channel_ids: channelIds,
                                    });
                                }
                            }}
                            channelIds={props.playbook.broadcast_channel_ids}
                        />
                    </Picker>
                    <div>&nbsp;</div>
                    <DetailsText>
                        {formatMessage({defaultMessage: 'and'})}
                    </DetailsText>
                    <Picker>
                        <WebhooksInput
                            webhookOnStatusUpdateURLs={props.playbook.webhook_on_status_update_enabled ? props.playbook.webhook_on_status_update_urls : []}
                            onChange={(newWebhookOnStatusUpdateURLs: string[]) => {
                                if (newWebhookOnStatusUpdateURLs.length === 0) {
                                    props.updatePlaybook({
                                        ...props.playbook,
                                        webhook_on_status_update_enabled: false,
                                        webhook_on_status_update_urls: [],
                                    });
                                } else {
                                    props.updatePlaybook({
                                        ...props.playbook,
                                        webhook_on_status_update_enabled: true,
                                        webhook_on_status_update_urls: newWebhookOnStatusUpdateURLs,
                                    });
                                }
                            }}
                        />
                    </Picker>
                    <div>&nbsp;</div>
                    <DetailsText>
                        {props.playbook.webhook_on_status_update_enabled &&
                            props.playbook.webhook_on_status_update_urls.length === 1 ? formatMessage({defaultMessage: 'URL'}) : formatMessage({defaultMessage: 'URLs'})}
                    </DetailsText>
                </Details>
                <Template>
                    <TextEdit
                        placeholder={formatMessage({defaultMessage: 'Use markdown to create a template'})}
                        value={props.playbook.reminder_message_template}
                        onSave={(newMessage: string) => {
                            props.updatePlaybook({
                                ...props.playbook,
                                reminder_message_template: newMessage,
                            });
                        }}
                    />
                </Template>
            </>
        );
    }

    return (
        <StatusUpdatesContainer>
            {updateComponent}
        </StatusUpdatesContainer>
    );
};

const StatusUpdatesContainer = styled.div`
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;

    color: var(--center-channel-color-72);
`;

const Details = styled.div`
    display: flex;
    align-items: baseline;
    flex-direction: row;
    flex-wrap: wrap;
    row-gap: 5px;
`;

const DetailsText = styled.div`
`;

const Picker = styled.div`
    margin-left: 6px;
    font-weight: 600;
    font-size: 12px;
    line-height: 15px;
    display: flex;
    align-items: center;
    color: var(--button-bg);
    background: var(--button-bg-08);
    border-radius: 12px;
    padding: 3px 6px 3px 10px;
`;

const Template = styled.div`
    margin-top: 16px;
`;

export default StatusUpdates;
