// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import styled, {css} from 'styled-components';

import {MultiSelect, SelectOption} from 'src/components/multi_select';

interface Props {
    default: string[] | undefined;
    onChange: (statuses: string[]) => void;
    options: StatusOption[];
}

export interface StatusOption {
    value: string;
    label: string;
}

interface PlaybookRunFilterButtonProps {
    active?: boolean;
}

export const PlaybookRunFilterButton = styled.button<PlaybookRunFilterButtonProps>`
    display: flex;
    align-items: center;
    border: none;
    padding: 8px;
    border-radius: 4px;
    color: var(--center-channel-color-56);
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    line-height: 12px;
    -webkit-transition: all 0.15s ease;
    -webkit-transition-delay: 0s;
    -moz-transition: all 0.15s ease;
    -o-transition: all 0.15s ease;
    transition: all 0.15s ease;
    padding: 0 16px;
    height: 4rem;

    :hover {
        background: var(--center-channel-color-08);
        color: var(--center-channel-color-72);
    }

    :active {
        background: var(--button-bg-08);
        color: var(--button-bg);
    }

    .icon-chevron-down {
        :before {
            margin: 0;
        }
    }

    ${(props) => props.active && css`
        cursor: pointer;
        background: var(--button-bg-08);
        color: var(--button-bg);
    `}
`;

export function StatusFilter(props: Props) {
    const opts = props.options.map((opt) => ({
        display: opt.label,
        value: opt.value,
        selected: props.default?.includes(opt.value) || false,
        disabled: false,
    }));

    // add devider
    opts.splice(1, 0, {
        display: '',
        value: 'divider',
        selected: false,
        disabled: false,
    });

    const [options, setOptions] = useState<SelectOption[]>(opts);
    const [filterOpen, setFilterOpen] = useState(false);

    const onSelectedChange = async (newOpts: SelectOption[], lastAction: SelectOption) => {
        let newOptions = newOpts;

        if (lastAction.value === '') {
            newOptions = newOptions.map((opt) => ({
                ...opt,
                disabled: lastAction.selected,
            }));
        }

        const selectCnt = newOptions
            .filter((opt) => opt.value !== '')
            .reduce((acm, opt) => (acm + (opt.selected ? 1 : 0)), 0);

        const allCheckbox = newOptions.filter((opt) => opt.value === '')[0];
        allCheckbox.disabled = false;

        setOptions(newOptions);

        if (allCheckbox.selected) { // everything is selected shouldn't filter using status at all
            props.onChange([]);
        } else if (selectCnt > 0) {
            props.onChange(
                newOptions
                    .filter((opt) => opt.selected && opt.value !== '' && opt.value !== 'divider')
                    .map((opt) => opt.value),
            );
        } else {
            props.onChange(['None']); // no status is selected, should return empty list
        }
    };

    const isOpenChange = async (isOpen: boolean) => {
        setFilterOpen(isOpen);
    };

    return (
        <MultiSelect
            target={
                <PlaybookRunFilterButton active={filterOpen}>
                    {'Status'}
                    {<i className='icon-chevron-down icon--small ml-2'/>}
                </PlaybookRunFilterButton>
            }
            options={options}
            onChange={onSelectedChange}
            isOpenChange={isOpenChange}
        />
    );
}
