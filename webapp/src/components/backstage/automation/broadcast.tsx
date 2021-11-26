// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {MenuListComponentProps} from 'react-select';
import {Scrollbars} from 'react-custom-scrollbars';
import styled from 'styled-components';

import {Channel} from 'mattermost-redux/types/channels';

import {FormattedMessage} from 'react-intl';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';
import ChannelSelector from 'src/components/backstage/channel_selector';
import ClearIcon from 'src/components/assets/icons/clear_icon';

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
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f349';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }
`;

const MenuListWrapper = styled.div`
    background-color: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;

    max-height: 280px;
`;

const MenuHeaderHeight = 44;

const MenuHeader = styled.div`
    height: ${MenuHeaderHeight}px;
    padding: 16px 0 12px 14px;
    font-size: 14px;
    font-weight: 600;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    line-height: 16px;
`;

const StyledScrollbars = styled(Scrollbars)`
    height: ${300 - MenuHeaderHeight}px;
`;

const ThumbVertical = styled.div`
    background-color: rgba(var(--center-channel-color-rgb), 0.24);
    border-radius: 2px;
    width: 4px;
    min-height: 45px;
    margin-left: -2px;
    margin-top: 6px;
`;

const MenuList = (props: MenuListComponentProps<Channel, boolean>) => {
    return (
        <MenuListWrapper>
            <MenuHeader><FormattedMessage defaultMessage='Announcement channel'/></MenuHeader>
            <StyledScrollbars
                autoHeight={true}
                renderThumbVertical={({style, ...thumbProps}) => <ThumbVertical {...thumbProps}/>}
            >
                {props.children}
            </StyledScrollbars>
        </MenuListWrapper>
    );
};

const ClearIndicator = ({clearValue}: {clearValue: () => void}) => (
    <div onClick={clearValue}>
        <ClearIcon/>
    </div>
);

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
