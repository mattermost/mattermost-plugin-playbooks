// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import DotMenu from 'src/components/dot_menu';
import {CheckboxContainer} from 'src/components/checklist_item';

const IconWrapper = styled.div`
    display: inline-flex;
    padding: 0 4px;
`;

const FilterCheckboxContainer = styled(CheckboxContainer)`
    margin: 0 30px 0 20px;
    line-height: 30px;
    align-items: center;

    input[type='checkbox'] {
        width: 16px;
        min-width: 16px;
        height: 16px;
        border: 1px solid var(--center-channel-color-24);
        border-radius: 2px;
    }
`;

const OptionDisplay = styled.div`
    margin: 0;
`;

export interface CheckboxOption {
    display: string;
    value: string;
    selected: boolean;
}

interface Props {
    options: CheckboxOption[];
    onselect: (value: string, checked: boolean) => void;
}

const MultiCheckbox = (props: Props) => (
    <DotMenu
        icon={
            <IconWrapper>
                <i className='icon icon-filter-variant'/>
            </IconWrapper>
        }
        menuCSS={'left: -234px;'}
        buttonCSS={'margin: 0 16px 0 auto'}
    >
        {props.options.map((option) => {
            return (
                <FilterCheckboxContainer
                    key={option.value}
                    onClick={() => props.onselect(option.value, !option.selected)}
                >
                    <input
                        type='checkbox'
                        checked={option.selected}
                    />
                    <OptionDisplay>{option.display}</OptionDisplay>
                </FilterCheckboxContainer>
            );
        })}
    </DotMenu>
);

export default MultiCheckbox;
