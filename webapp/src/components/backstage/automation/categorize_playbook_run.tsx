// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {MenuListComponentProps} from 'react-select';
import {Scrollbars} from 'react-custom-scrollbars';
import styled from 'styled-components';

import {ChannelCategory} from 'mattermost-redux/types/channel_categories';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';

import CategorySelector from 'src/components/backstage/category_selector';
import ClearIcon from 'src/components/assets/icons/clear_icon';

interface Props {
    enabled: boolean;
    onToggle: () => void;
    categoryName: string;
    onCategorySelected: (categoryName: string) => void;
}

export const CategorizePlaybookRun = (props: Props) => (
    <AutomationHeader>
        <AutomationTitle>
            <Toggle
                isChecked={props.enabled}
                onChange={props.onToggle}
            />
            <div>{'Add the channel to a sidebar category'}</div>
        </AutomationTitle>
        <SelectorWrapper>
            <StyledCategorySelector
                id='playbook-automation-categorize-playbook-run'
                onCategorySelected={props.onCategorySelected}
                categoryName={props.categoryName}
                isClearable={true}
                selectComponents={{ ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList }}
                isDisabled={!props.enabled}
                captureMenuScroll={false}
                shouldRenderValue={props.enabled}
                placeholder={'Enter category name'}
            />
        </SelectorWrapper>
    </AutomationHeader>
);

const StyledCategorySelector = styled(CategorySelector)`
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .channel-selector__control {
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

const MenuList = (props: MenuListComponentProps<ChannelCategory>) => {
    return (
        <MenuListWrapper>
            <MenuHeader>{'Select a category'}</MenuHeader>
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