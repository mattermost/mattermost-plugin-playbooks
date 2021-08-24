// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, ComponentProps} from 'react';
import styled from 'styled-components';
import {parse, parseDate} from 'chrono-node';

import {debounce} from 'debounce';
import AsyncSelect from 'react-select/async';
import {ControlProps, OptionsType} from 'react-select';

import {Timestamp} from 'src/webapp_globals';

const StyledAsyncSelect = styled(AsyncSelect)`
    flex-grow: 1;
    background-color: var(--center-channel-bg);

    .datetime-autocomplete__menu-list {
        background-color: var(--center-channel-bg);
        border: none;
    }

    .datetime-autocomplete__input {
        color: var(--center-channel-color);
    }

    .datetime-autocomplete__option--is-selected {
        background-color: var(--center-channel-color-08);
    }

    .datetime-autocomplete__option--is-focused {
        background-color: var(--center-channel-color-16);
    }

    .datetime-autocomplete__control {
        -webkit-transition: all 0.15s ease;
        -webkit-transition-delay: 0s;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px var(--center-channel-color-16);
        width: 100%;
        height: 4rem;
        font-size: 14px;
        padding-left: 3.2rem;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }

        &:before {
            left: 16px;
            top: 8px;
            position: absolute;
            color: var(--center-channel-color-56);
            content: '\f150';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }

    .datetime-autocomplete__option {
        &:active {
            background-color: var(--center-channel-color-08);
        }
    }
`;

type Props = {
    defaultInputValue: number | null;
    setValue: (value: number | null) => void;
    makeDefaultOptions?: (query: string) => OptionsType<Option>;
} & Omit<Partial<ComponentProps<typeof AsyncSelect>>, 'value'>;

export const makeOption = (query: string): Option => ({label: query, ts: parseDate(query).getTime()});

type Option = {
    label?: string;
    ts: number | null;
    showTimestamp?: boolean;
}

const DateTimeInput = ({
    defaultInputValue,
    setValue,
    makeDefaultOptions,
    ...selectProps
}: Props) => {
    const onChange = (option?: Option) => {
        setValue(option?.ts ?? null);
    };

    const loadOptions = (query: string, setOptions: (options: OptionsType<Option>) => void) => {
        getOptions(query, setOptions, makeDefaultOptions);
    };

    return (
        <StyledAsyncSelect
            isMulti={false}
            cacheOptions={false}
            defaultOptions={true}
            loadOptions={loadOptions}
            filterOption={() => true}
            onChange={onChange}
            getOptionValue={getValue}
            getOptionLabel={getLabel}
            formatOptionLabel={OptionLabel}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={true}
            isOptionDisabled={(option: Option) => !option.ts}
            placeholder={'Add reminder'}
            components={{
                IndicatorSeparator,
            }}
            styles={customStyles}
            classNamePrefix='datetime-autocomplete'
            {...selectProps}
        />
    );
};

const getOptions = debounce((
    query: string,
    setOptions: (options: OptionsType<Option>) => void,
    makeDefaultOptions?: (query: string) => OptionsType<Option>,
) => {
    const results = parse(query);
    if (query.trim().length !== 0) {
        setOptions(results.map(({start}) => ({
            ts: start.date().getTime(),
        })));
    } else if (makeDefaultOptions) {
        setOptions(makeDefaultOptions(query));
    }
}, 150);

const customStyles = {
    control: (provided: ControlProps<Option>) => ({
        ...provided,
        minHeight: 34,
    }),
};

const IndicatorSeparator = () => null;
const OptionLabel = ({label, ts}: Option) => label ?? (ts && (
    <Timestamp
        value={ts}
        {...TIME_SPEC}
    />
));
const getValue = ({ts}: Option) => ts;
const getLabel = ({label, ts}: Option) => label ?? ts;

const TIME_SPEC = {
    locale: 'en',
    useDate: (value: string, {weekday, day, month, year}: any) => ({weekday, day, month, year}),
};

export const useDateTimeInput = (defaultInputValue: number | null, makeDefaultOptions?: () => OptionsType<Option>) => {
    const [value, setValue] = useState(defaultInputValue ?? null);

    const input = <DateTimeInput {...{defaultInputValue, setValue, makeDefaultOptions}}/>;

    return {input, value};
};

export default DateTimeInput;
