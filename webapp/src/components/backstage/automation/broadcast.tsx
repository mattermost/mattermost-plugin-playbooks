// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import {Channel} from 'mattermost-redux/types/channels';

import {FormattedMessage} from 'react-intl';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';
import ChannelSelector from 'src/components/backstage/channel_selector';
import ClearIcon from 'src/components/assets/icons/clear_icon';
import ClearIndicator from 'src/components/backstage/automation/clear_indicator';
import MenuList from 'src/components/backstage/automation/menu_list';

interface Props {
    enabled: boolean;
    onToggle: () => void;
    channelIds: string[];
    onChannelsSelected: (channelIds: string[]) => void;
}

export const Broadcast = (props: Props) => {
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
                <StyledChannelSelector
                    id='playbook-automation-broadcast'
                    onChannelsSelected={props.onChannelsSelected}
                    channelIds={props.channelIds}
                    isClearable={true}
                    selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList, MultiValueRemove}}
                    isDisabled={!props.enabled}
                    captureMenuScroll={false}
                    shouldRenderValue={props.enabled}
                    placeholder={'Select a channel'}
                />
            </SelectorWrapper>
        </AutomationHeader>
    );
};

const StyledChannelSelector = styled(ChannelSelector)`
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .playbooks-rselect__control {
        padding: 4px 16px 4px 3.2rem;

        &:before {
            left: 16px;
            top: 8px;
            position: absolute;
            color: var(--center-channel-color-56);
            content: '\f349';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }
`;

interface MultiValueRemoveProps {
    innerProps: {
        onClick: () => void;
    }
}

const MultiValueRemove = (props: MultiValueRemoveProps) => (
    <StyledClearIcon
        onClick={(e) => {
            props.innerProps.onClick();
            e.stopPropagation();
        }}
    />
);

const StyledClearIcon = styled(ClearIcon)`
    color: rgba(var(--center-channel-color-rgb), 0.32);
    font-size: 15px;
    cursor: pointer;

    :hover {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;
