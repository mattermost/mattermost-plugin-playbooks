// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {ChannelAction, ChannelActionType} from 'src/types/channel_actions';
import MarkdownTextbox from 'src/components/markdown_textbox';
import {isCurrentUserChannelAdmin} from 'src/selectors';

interface Props {
    action: ChannelAction;
    onUpdate: (update: (prevActions: Record<string, ChannelAction>) => Record<string, ChannelAction>) => void;
    editable: boolean;
}

const ActionChildren = (props: Props) => {
    switch (props.action.action_type) {
    case ChannelActionType.WelcomeMessage:
        return <WelcomeActionChildren {...props}/>;
    }

    return null;
};

const WelcomeActionChildren = ({action, onUpdate, editable}: Props) => {
    const {formatMessage} = useIntl();
    const isChannelAdmin = useSelector(isCurrentUserChannelAdmin);

    return (
        <MarkdownTextbox
            placeholder={formatMessage({defaultMessage: 'Define a message to welcome any new member that joins the channel.'})}
            value={action.payload.message}
            setValue={(newMessage: string) => onUpdate((prevActions: Record<string, ChannelAction>) => ({
                ...prevActions,
                [action.action_type]: {
                    ...prevActions[action.action_type],
                    payload: {
                        message: newMessage,
                    },
                },
            }))}
            id={'channel-actions-modal_welcome-msg'}
            hideHelpText={true}
            hideButtonsRow={!isChannelAdmin}
            previewByDefault={!isChannelAdmin}
            disabled={!editable}
        />
    );
};

export default ActionChildren;
