// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {Link} from 'react-router-dom';

import {useSelector} from 'react-redux';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {GlobalState} from 'mattermost-redux/types/store';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {pluginId} from 'src/manifest';
import GenericModal, {Description, Label} from 'src/components/widgets/generic_modal';
import {PlaybookRun} from 'src/types/playbook_run';

import {usePlaybook} from 'src/hooks';
import MarkdownTextbox from '../markdown_textbox';
import {pluginUrl} from 'src/browser_routing';
import {postStatusUpdate} from 'src/client';

const ID = `${pluginId}_${nameof(UpdateRunStatusModal)}`;

type Props = {
    playbookRunId: PlaybookRun['id'];
    playbookId: PlaybookRun['playbook_id'];
    channelId: PlaybookRun['channel_id'];
}

export function makeModalDefinition(props: Props) {
    return {
        modalId: ID,
        dialogType: UpdateRunStatusModal,
        dialogProps: props,
    };
}

function UpdateRunStatusModal({playbookRunId, playbookId, channelId, ...props}: Props) {
    const {formatMessage} = useIntl();
    const [message, setMessage] = useState<string | null>(null);
    const playbook = usePlaybook(playbookId);
    if (playbook && message == null) {
        setMessage(playbook.reminder_message_template);
    }
    const currentUserId = useSelector(getCurrentUserId);
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId) || {display_name: 'Unknown Channel', id: channelId});
    const team = useSelector((state: GlobalState) => getTeam(state, channel.team_id));

    const onConfirm = () => {
        if (!message) {
            return false;
        }
        postStatusUpdate(playbookRunId, {message}, {user_id: currentUserId, channel_id: channel.id, team_id: team.id});
        return true;
    };

    return (
        <GenericModal
            id={ID}
            modalHeaderText={'Post update'}
            confirmButtonText={'Post'}
            cancelButtonText={'Cancel'}
            handleCancel={() => true}
            handleConfirm={onConfirm}
            {...props}
        >
            <FormContainer>
                <Description>
                    {formatMessage({
                        id: `${ID}_description`,
                        defaultMessage: 'This update will be saved to the <OverviewLink>overview page</OverviewLink>{hasBroadcast, select, true { and broadcast to {broadcastChannel}} other {}}.',
                    }, {
                        OverviewLink: (...chunks) => {
                            return (
                                <Link
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    to={pluginUrl(`/runs/${playbookRunId}`)}
                                >
                                    {chunks}
                                </Link>
                            );
                        },
                        hasBroadcast: playbook?.broadcast_channel_id ? 'true' : 'false',
                        broadcastChannel: (
                            <Link
                                target='_blank'
                                rel='noopener noreferrer'
                                to={`/${team.name}/channels/${channelId}`}
                            >
                                {`~${channel.name}`}
                            </Link>
                        ),
                    })}
                </Description>
                <Label>
                    {'Change since last update'}
                </Label>
                <MarkdownTextbox
                    id='update_run_status_textbox'
                    value={message ?? ''}
                    setValue={setMessage}
                    autocompleteChannelId={channelId}
                />
            </FormContainer>
        </GenericModal>
    );
}

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    color: var(--center-channel-color);
`;

export default UpdateRunStatusModal;
