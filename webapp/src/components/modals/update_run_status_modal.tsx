// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useState} from 'react';
import {Link} from 'react-router-dom';

import {useSelector} from 'react-redux';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {GlobalState} from 'mattermost-redux/types/store';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import GenericModal, {Description, Label} from 'src/components/widgets/generic_modal';

import {usePlaybook} from 'src/hooks';
import MarkdownTextbox from '../markdown_textbox';
import {pluginUrl} from 'src/browser_routing';
import {postStatusUpdate} from 'src/client';
import Tooltip from 'src/components/widgets/tooltip';

const ID = 'playbooks_update_run_status_dialog';

type Props = {
    playbookRunId: string;
    playbookId: string;
    channelId: string;
    hasPermission: boolean;
} & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: UpdateRunStatusModal,
    dialogProps: props,
});

const UpdateRunStatusModal = ({
    playbookRunId,
    playbookId,
    channelId,
    hasPermission,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const [message, setMessage] = useState<string | null>(null);
    const playbook = usePlaybook(playbookId);
    if (playbook && message == null) {
        setMessage(playbook.reminder_message_template);
    }
    const currentUserId = useSelector(getCurrentUserId);
    const team = useSelector((state: GlobalState) => playbook && getTeam(state, playbook.team_id));

    const broadcastChannelNames = useSelector((state: GlobalState) => {
        return playbook?.broadcast_channel_ids.reduce<string[]>((result, id) => {
            const displayName = getChannel(state, id)?.display_name;

            if (displayName) {
                result.push(displayName);
            }
            return result;
        }, [])?.join(', ');
    });

    const onConfirm = () => {
        if (!message || !hasPermission) {
            return false;
        }
        if (message && currentUserId && channelId && team) {
            postStatusUpdate(playbookRunId, {message}, {user_id: currentUserId, channel_id: channelId, team_id: team.id});
        }
        return true;
    };

    const form = (
        <FormContainer>
            <Description>
                {formatMessage({
                    id: `${ID}_description`,
                    defaultMessage: 'This update will be saved to the <OverviewLink>overview page</OverviewLink>{hasBroadcast, select, true { and broadcast to <ChannelsTooltip>{broadcastChannelCount, plural, =1 {one channel} other {{broadcastChannelCount, number} channels}}</ChannelsTooltip>} other {}}.',
                }, {
                    OverviewLink: (...chunks) => (
                        <Link
                            target='_blank'
                            rel='noopener noreferrer'
                            to={pluginUrl(`/runs/${playbookRunId}`)}
                        >
                            {chunks}
                        </Link>
                    ),
                    ChannelsTooltip: (...chunks) => (
                        <Tooltip
                            id={`${ID}_broadcast_tooltip`}
                            content={broadcastChannelNames}
                        >
                            <span tabIndex={0}>{chunks}</span>
                        </Tooltip>
                    ),
                    hasBroadcast: Boolean(playbook?.broadcast_channel_ids?.length).toString(),
                    broadcastChannelCount: playbook?.broadcast_channel_ids.length ?? 0,
                })}
            </Description>
            <Label>
                {'Change since last update'}
            </Label>
            <MarkdownTextbox
                id='update_run_status_textbox'
                value={message ?? ''}
                setValue={setMessage}
                channelId={channelId}
            />
        </FormContainer>
    );

    const warning = (
        <WarningBlock>
            <span>
                {'You do not have permission to post an update.'}
            </span>
        </WarningBlock>
    );

    return (
        <GenericModal
            modalHeaderText={'Post update'}
            cancelButtonText={hasPermission ? 'Cancel' : 'Close'}
            confirmButtonText={hasPermission ? 'Post' : 'Ok'}
            handleCancel={() => true}
            handleConfirm={hasPermission ? onConfirm : null}
            isConfirmDisabled={!(message && currentUserId && channelId && team && hasPermission)}
            {...modalProps}
            id={ID}
        >
            {hasPermission ? form : warning}
        </GenericModal>
    );
};

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    color: var(--center-channel-color);
    ${Description} {
        span {
            text-decoration: underline;
            font-weight: bold;
        }
    }
`;

const WarningBlock = styled.div`
    padding: 2rem;
    display: flex;
    place-content: center;
    span {
        padding: 1.5rem;
    }
`;

export default UpdateRunStatusModal;
