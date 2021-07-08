// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {MultiSelect, SelectOption} from '../../../multi_select';
import './status_filter.scss';

interface Props {
    default: string[] | undefined;
    onChange: (statuses: string[]) => void;
    options: StatusOption[];
}

export interface StatusOption {
    value: string;
    label: string;
}

export function StatusFilter(props: Props) {
    const opts = props.options.map((opt) => ({
        display: opt.label,
        value: opt.value,
        selected: props.default?.includes(opt.value) || false,
        disabled: false,
    }));

    const [options, setOptions] = useState<SelectOption[]>(opts);

    const onSelectedChange = async (newOpts: SelectOption[], lastAction: SelectOption) => {
        let newOptions = newOpts;

        if (lastAction.value === '') {
            newOptions = newOptions.map((opt) => ({
                ...opt,
                selected: lastAction.selected,
            }));
        }

        const selectCnt = newOptions
            .filter((opt) => opt.value !== '')
            .reduce((acm, opt) => (acm + (opt.selected ? 1 : 0)), 0);
        const allCheckbox = newOptions.filter((opt) => opt.value === '')[0];

        allCheckbox.selected = selectCnt === newOptions.length - 1;

        setOptions(newOptions);

        if (allCheckbox.selected) { // everything is selected shouldn't filter using status at all
            props.onChange([]);
        } else if (selectCnt > 0) {
            props.onChange(
                newOptions.filter((opt) => opt.selected && opt.value !== '').map((opt) => opt.value),
            );
        } else {
            props.onChange(['_']); // no status is selected, should return empty list
        }
    };

    return (
        <MultiSelect
            target={
                <button className='PlaybookRunFilter-button'>
                    {'Status'}
                    {<i className='icon-chevron-down icon--small ml-2'/>}
                </button>
            }
            options={options}
            onChange={onSelectedChange}
        />
    );
}
