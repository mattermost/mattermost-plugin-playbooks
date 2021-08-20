// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {MultiSelect, SelectOption} from 'src/components/multi_select';
import {PlaybookRunFilterButton} from '../styles';

interface Props {
    statuses: string[];
    onChange: (statuses: string[]) => void;
}

const statusOptions: SelectOption[] = [
    {value: '', display: 'All', selected: false, disabled: false},
    {value: 'divider', display: '', selected: false, disabled: false},
    {value: 'InProgress', display: 'In Progress', selected: false, disabled: false},
    {value: 'Finished', display: 'Finished', selected: false, disabled: false},
];

function statusesToOptions(statuses: string[]) {
    // All Selected
    if (statuses.length === 0) {
        return [
            {value: '', display: 'All', selected: true, disabled: false},
            {value: 'divider', display: '', selected: false, disabled: false},
            {value: 'InProgress', display: 'In Progress', selected: true, disabled: true},
            {value: 'Finished', display: 'Finished', selected: true, disabled: true},
        ];
    }

    // None Selected
    if (statuses.length === 1 && statuses[0] === 'None') {
        return [...statusOptions];
    }

    // Somewhere in the middle
    return statusOptions.map((statusOption: SelectOption) => {
        return {
            ...statusOption,
            selected: statuses.includes(statusOption.value),
        };
    });
}

export function StatusFilter(props: Props) {
    const [filterOpen, setFilterOpen] = useState(false);

    const onSelectedChange = async (newOptions: SelectOption[]) => {
        const numberOfOptionsSelected = newOptions
            .filter((opt) => opt.value !== '')
            .reduce((acm, opt) => (acm + (opt.selected ? 1 : 0)), 0);

        const allCheckbox = newOptions.filter((opt) => opt.value === '')[0];
        if (allCheckbox.selected) { // everything is selected shouldn't filter using status at all
            props.onChange([]);
        } else if (numberOfOptionsSelected > 0) {
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
            options={statusesToOptions(props.statuses)}
            onChange={onSelectedChange}
            isOpenChange={isOpenChange}
        />
    );
}
