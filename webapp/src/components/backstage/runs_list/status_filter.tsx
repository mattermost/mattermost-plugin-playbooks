// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {MultiSelect, SelectOption} from 'src/components/multi_select';
import {PlaybookRunFilterButton} from '../styles';

interface Props {
    default: string[] | undefined;
    onChange: (statuses: string[]) => void;
}

export const statusOptions: StatusOption[] = [
    {value: '', label: 'All'},
    {value: 'InProgress', label: 'In Progress'},
    {value: 'Finished', label: 'Finished'},
];

interface StatusOption {
    value: string;
    label: string;
}

export function StatusFilter(props: Props) {
    const opts = statusOptions.map((opt) => ({
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
                    <FormattedMessage defaultMessage='Status'/>
                    {<i className='icon-chevron-down icon--small ml-2'/>}
                </PlaybookRunFilterButton>
            }
            options={options}
            onChange={onSelectedChange}
            isOpenChange={isOpenChange}
        />
    );
}
