// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useUpdateEffect} from 'react-use';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {useQuery} from '@apollo/client';

import {hideRunActionsModal} from 'src/actions';
import {isRunActionsModalVisible} from 'src/selectors';
import {useUpdateRun} from 'src/graphql/hooks';
import Action from 'src/components/actions_modal_action';
import Trigger from 'src/components/actions_modal_trigger';
import ActionsModal, {ActionsContainer, TriggersContainer} from 'src/components/actions_modal';
import BroadcastChannelSelector from 'src/components/broadcast_channel_selector';
import PatternedTextArea from 'src/components/patterned_text_area';
import {PlaybookRunEventTarget} from 'src/types/telemetry';
import {telemetryEvent} from 'src/client';
import {graphql} from 'src/graphql/generated';

const runActionsModalQuery = graphql(/* GraphQL */`
    query RunActionsModal($runID: String!) {
        run(id: $runID) {
            id
            teamID
            playbookID
            statusUpdateBroadcastChannelsEnabled
            statusUpdateBroadcastWebhooksEnabled
            createChannelMemberOnNewParticipant
            removeChannelMemberOnRemovedParticipant
            broadcastChannelIDs
            webhookOnStatusUpdateURLs
        }
    }
`);

interface Props {
    runID: string;
    readOnly: boolean;
}

const RunActionsModal = ({runID, readOnly}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const show = useSelector(isRunActionsModalVisible);

    const {data} = useQuery(runActionsModalQuery, {
        variables: {
            runID,
        },
    });
    const playbookRun = data?.run;

    const teamId = playbookRun?.teamID || '';

    const [broadcastToChannelsEnabled, setBroadcastToChannelsEnabled] = useState(playbookRun?.statusUpdateBroadcastChannelsEnabled ?? false);
    const [sendOutgoingWebhookEnabled, setSendOutgoingWebhookEnabled] = useState(playbookRun?.statusUpdateBroadcastWebhooksEnabled ?? false);

    const [createChannelMemberEnabled, setCreateChannelMemberEnabled] = useState(playbookRun?.createChannelMemberOnNewParticipant ?? false);
    const [removeChannelMemberEnabled, setRemoveChannelMemberEnabled] = useState(playbookRun?.removeChannelMemberOnRemovedParticipant ?? false);

    const [channelIds, setChannelIds] = useState(playbookRun?.broadcastChannelIDs ?? []);
    const [webhooks, setWebhooks] = useState(playbookRun?.webhookOnStatusUpdateURLs ?? []);
    const [isValid, setIsValid] = useState<boolean>(true);
    const updateRun = useUpdateRun(runID);

    useUpdateEffect(() => {
        setBroadcastToChannelsEnabled(playbookRun?.statusUpdateBroadcastChannelsEnabled ?? false);
    }, [playbookRun?.statusUpdateBroadcastChannelsEnabled]);

    useUpdateEffect(() => {
        setSendOutgoingWebhookEnabled(playbookRun?.statusUpdateBroadcastWebhooksEnabled ?? false);
    }, [playbookRun?.statusUpdateBroadcastWebhooksEnabled]);

    useUpdateEffect(() => {
        setCreateChannelMemberEnabled(playbookRun?.createChannelMemberOnNewParticipant ?? false);
    }, [playbookRun?.createChannelMemberOnNewParticipant]);

    useUpdateEffect(() => {
        setRemoveChannelMemberEnabled(playbookRun?.removeChannelMemberOnRemovedParticipant ?? false);
    }, [playbookRun?.removeChannelMemberOnRemovedParticipant]);

    useUpdateEffect(() => {
        setChannelIds(playbookRun.broadcastChannelIDs);
    }, [playbookRun?.broadcastChannelIDs]);

    useUpdateEffect(() => {
        setWebhooks(playbookRun.webhookOnStatusUpdateURLs);
    }, [playbookRun?.webhookOnStatusUpdateURLs]);

    const onHide = () => {
        dispatch(hideRunActionsModal());

        setBroadcastToChannelsEnabled(playbookRun?.statusUpdateBroadcastChannelsEnabled ?? false);
        setChannelIds(playbookRun?.broadcastChannelIDs ?? []);

        setSendOutgoingWebhookEnabled(playbookRun?.statusUpdateBroadcastChannelsEnabled ?? false);
        setWebhooks(playbookRun?.webhookOnStatusUpdateURLs ?? []);

        setCreateChannelMemberEnabled(playbookRun?.createChannelMemberOnNewParticipant ?? false);
        setRemoveChannelMemberEnabled(playbookRun?.removeChannelMemberOnRemovedParticipant ?? false);
    };

    const onSave = () => {
        dispatch(hideRunActionsModal());
        telemetryEvent(PlaybookRunEventTarget.UpdateActions, {
            playbookrun_id: runID,
            playbook_id: playbookRun?.playbookID || '',
        });
        updateRun({
            statusUpdateBroadcastChannelsEnabled: broadcastToChannelsEnabled,
            broadcastChannelIDs: channelIds,
            statusUpdateBroadcastWebhooksEnabled: sendOutgoingWebhookEnabled,
            webhookOnStatusUpdateURLs: webhooks,
            createChannelMemberOnNewParticipant: createChannelMemberEnabled,
            removeChannelMemberOnRemovedParticipant: removeChannelMemberEnabled,
        });
    };

    return (
        <ActionsModal
            id={'run-actions-modal'}
            title={formatMessage({defaultMessage: 'Run Actions'})}
            subtitle={formatMessage({defaultMessage: 'Run actions allow you to automate activities for this channel'})}
            show={show}
            onHide={onHide}
            editable={!readOnly}
            onSave={onSave}
            isValid={isValid}
        >
            <TriggersContainer>
                <Trigger
                    title={formatMessage({defaultMessage: 'When a status update is posted'})}
                >
                    <ActionsContainer>
                        <Action
                            enabled={broadcastToChannelsEnabled}
                            title={formatMessage({defaultMessage: 'Broadcast update to selected channels'})}
                            editable={!readOnly}
                            onToggle={() => setBroadcastToChannelsEnabled((prev) => !prev)}
                        >
                            <BroadcastChannelSelector
                                id='run-actions-broadcast'
                                enabled={!readOnly && broadcastToChannelsEnabled}
                                channelIds={channelIds}
                                onChannelsSelected={setChannelIds}
                                teamId={teamId}
                            />
                        </Action>
                        <Action
                            enabled={sendOutgoingWebhookEnabled}
                            title={formatMessage({defaultMessage: 'Send outgoing webhook'})}
                            editable={!readOnly}
                            onToggle={() => setSendOutgoingWebhookEnabled((prev) => !prev)}
                        >
                            <PatternedTextArea
                                enabled={!readOnly && sendOutgoingWebhookEnabled}
                                placeholderText={formatMessage({defaultMessage: 'Enter webhook'})}
                                errorText={formatMessage({defaultMessage: 'Invalid webhook URLs'})}
                                input={webhooks.join('\n')}
                                pattern={'https?://.*'}
                                delimiter={'\n'}
                                onChange={(newWebhooks: string) => setWebhooks(newWebhooks.split('\n'))}
                                rows={3}
                                maxRows={64}
                                maxErrorText={formatMessage({defaultMessage: 'Invalid entry: the maximum number of webhooks allowed is 64'})}
                                resize={'vertical'}
                                onValidationChange={(valid) => setIsValid(valid)}
                            />
                            <HelpText>
                                {formatMessage({defaultMessage: 'Please enter one webhook per line'})}
                            </HelpText>
                        </Action>
                    </ActionsContainer>
                </Trigger>

                <Trigger
                    title={formatMessage({defaultMessage: 'When a participant joins the run'})}
                >
                    <ActionsContainer>
                        <Action
                            enabled={createChannelMemberEnabled}
                            title={formatMessage({defaultMessage: 'Add them to the run channel'})}
                            editable={!readOnly}
                            onToggle={() => setCreateChannelMemberEnabled(!createChannelMemberEnabled)}
                        />
                    </ActionsContainer>
                </Trigger>

                <Trigger
                    title={formatMessage({defaultMessage: 'When a participant leaves the run'})}
                >
                    <ActionsContainer>
                        <Action
                            enabled={removeChannelMemberEnabled}
                            title={formatMessage({defaultMessage: 'Remove them from the run channel'})}
                            editable={!readOnly}
                            onToggle={() => setRemoveChannelMemberEnabled(!removeChannelMemberEnabled)}
                        />
                    </ActionsContainer>
                </Trigger>
            </TriggersContainer>
        </ActionsModal>
    );
};

const HelpText = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-top: 4px;
`;

export default RunActionsModal;
