// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {FormattedMessage} from 'react-intl';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/playbook_edit/automation/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import BroadcastChannelSelector from 'src/components/broadcast_channel_selector';

interface Props {
    enabled: boolean;
    onToggle: () => void;
    channelIds: string[];
    onChannelsSelected: (channelIds: string[]) => void;
}

export const Broadcast = (props: Props) => {
    const teamId = useSelector(getCurrentTeamId);

    return (
        <AutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                />
                <div><FormattedMessage defaultMessage='Broadcast update to other channels'/></div>
            </AutomationTitle>
            <SelectorWrapper>
                <BroadcastChannelSelector
                    id='playbook-automation-broadcast'
                    enabled={props.enabled}
                    channelIds={props.channelIds}
                    onChannelsSelected={props.onChannelsSelected}
                    teamId={teamId}
                />
            </SelectorWrapper>
        </AutomationHeader>
    );
};

