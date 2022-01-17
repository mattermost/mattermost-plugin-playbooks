// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import styled from 'styled-components';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/playbook_edit/automation/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

import CategorySelector from 'src/components/backstage/category_selector';

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
            <div><FormattedMessage defaultMessage='Add the channel to a sidebar category'/></div>
        </AutomationTitle>
        <SelectorWrapper>
            <StyledCategorySelector
                id='playbook-automation-categorize-playbook-run'
                onCategorySelected={props.onCategorySelected}
                categoryName={props.categoryName}
                isClearable={true}
                selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
                isDisabled={!props.enabled}
                captureMenuScroll={false}
                shouldRenderValue={props.enabled}
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
