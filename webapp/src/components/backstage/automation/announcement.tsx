// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {MenuListComponentProps} from 'react-select';
import {Scrollbars} from 'react-custom-scrollbars';
import styled from 'styled-components';

import {ActionFunc} from 'mattermost-redux/types/actions';
import {Channel} from 'mattermost-redux/types/channels';

import Profile from 'src/components/profile/profile';
import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';
import ChannelSelector from 'src/components/backstage/channel_selector';

interface Props {
    enabled: boolean;
    onToggle: () => void;
    channelId?: string;
    onChannelSelected: (channelID: string | undefined) => void;
}

export const Announcement = (props: Props) => (
    <AutomationHeader>
        <AutomationTitle>
            <Toggle
                isChecked={props.enabled}
                onChange={props.onToggle}
            />
            <div>{'Announce in another channel'}</div>
        </AutomationTitle>
        <SelectorWrapper>
            <StyledChannelSelector
                id='playbook-automation-announcement'
                onChannelSelected={props.onChannelSelected}
                channelId={props.channelId}
                isClearable={false}
                selectComponents={{DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
                isDisabled={!props.enabled}
                captureMenuScroll={false}
                shouldRenderValue={props.enabled}
                placeholder={'Search for channel'}
            />
        </SelectorWrapper>
    </AutomationHeader>
);

const StyledChannelSelector = styled(ChannelSelector)`
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .channel-selector__control {
        padding-left: 3.2rem;
        padding-right: 16px;

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

const MenuList = (props: MenuListComponentProps<Channel>) => {
    return (
        <MenuListWrapper>
            <MenuHeader>{'Announcement channel'}</MenuHeader>
            <StyledScrollbars
                autoHeight={true}
                renderThumbVertical={({style, ...thumbProps}) => <ThumbVertical {...thumbProps}/>}
            >
                {props.children}
            </StyledScrollbars>
        </MenuListWrapper>
    );
};
