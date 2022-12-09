// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import styled from 'styled-components';

import {
    AutomationHeader,
    AutomationLabel,
    AutomationTitle,
    SelectorWrapper,
} from 'src/components/backstage/playbook_edit/automation/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

import CategorySelector from 'src/components/backstage/category_selector';

interface Props {
    enabled: boolean;
    disabled?: boolean;
    onToggle: () => void;
    categoryName: string;
    onCategorySelected: (categoryName: string) => void;
}

export const CategorizePlaybookRun = (props: Props) => {
    const {formatMessage} = useIntl();
    return (
        <AutomationHeader>
            <AutomationTitle>
                <Toggle
                    inputId={'categorize-playbook-run-toggle'}
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                    disabled={props.disabled}
                />
                <AutomationLabel htmlFor={'categorize-playbook-run-toggle'}>
                    <FormattedMessage defaultMessage='Add the channel to a sidebar category'/>
                </AutomationLabel>
            </AutomationTitle>
            <SelectorWrapper>
                <StyledCategorySelector
                    id='playbook-automation-categorize-playbook-run'
                    onCategorySelected={props.onCategorySelected}
                    categoryName={props.categoryName}
                    isClearable={true}
                    selectComponents={{ClearIndicator, IndicatorSeparator: () => null, MenuList}}
                    isDisabled={props.disabled || !props.enabled}
                    captureMenuScroll={false}
                    shouldRenderValue={props.enabled}
                    placeholder={formatMessage({defaultMessage: 'Enter category name'})}
                />
            </SelectorWrapper>
        </AutomationHeader>
    );
};

const StyledCategorySelector = styled(CategorySelector)`
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};
`;
