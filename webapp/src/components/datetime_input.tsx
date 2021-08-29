// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, ComponentProps, useMemo, useRef, useEffect} from 'react';
import styled from 'styled-components';
import {parse, parseDate, ParsedResult, ParsingOption} from 'chrono-node';
import parseDuration from 'parse-duration';

import {debounce} from 'debounce';
import Select from 'react-select';

import moment from 'moment';

import {useIntl} from 'react-intl';

import {Timestamp} from 'src/webapp_globals';

const StyledSelect = styled(Select)`
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

export enum InputMode {
    DateTime = 'DateTime',
    Duration = 'Duration',

    Auto = 'Auto'
}

const durationFromQuery = (query: string) => {
    const ms = parseDuration(query);
    return (ms && moment.duration(ms, 'millisecond')) || null;
};

export function infer(query: string, mode: InputMode.DateTime): ReturnType<typeof parseDate>;
export function infer(query: string, mode: InputMode.Duration): ReturnType<typeof durationFromQuery>;
export function infer(query: string, mode?: InputMode): Option['value'];
export function infer(query: string, mode = InputMode.Auto) {
    switch (mode) {
    case InputMode.DateTime:
        return parseDate(query);
    case InputMode.Duration:
        return durationFromQuery(query);
    case InputMode.Auto:
    default:
        return parseDate(query) ?? durationFromQuery(query);
    }
}

export const ms = (value: Option['value']): number => {
    if (value instanceof Date) {
        return value.getTime();
    }
    if (moment.isDuration(value)) {
        return value.asMilliseconds();
    }
    return 0;
};

export const makeOption = (query: string, mode = InputMode.Auto): Option => {
    const value = infer(query, mode);
    return {label: query, value};
};
export type Option = {
    label?: string;
    value: Date | moment.Duration | null;
}

type Props = {
    mode?: InputMode;
    onChange: (value: Option | null) => void;
    defaultOption?: Option;
    defaultOptions?: Option[];
    makeOptions?: (
        query: string,
        datetimeResults: ParsedResult[],
        durationResults: moment.Duration[],
    ) => Option[] | null;
    parsingOptions?: ParsingOption;
} & Partial<ComponentProps<typeof StyledSelect>>;

const DateTimeInput = ({
    mode = InputMode.DateTime,
    value,
    defaultOptions,
    makeOptions = (query, datetimeResults, durationResults) => {
        switch (mode) {
        case InputMode.DateTime:
            return datetimeResults.length ? datetimeResults.map(({start}) => ({value: start.date()})) : null;
        case InputMode.Duration:
            return durationResults.length ? durationResults.map((duration) => ({label: duration.humanize(), value: duration})) : null;
        case InputMode.Auto:
        default:
            return null;
        }
    },
    parsingOptions,
    ...selectProps
}: Props) => {
    const [options, setOptions] = useState<Option[] | null>(null);
    const {formatMessage} = useIntl();

    const updateOptions = useMemo(() => debounce((query: string) => {
        // eslint-disable-next-line no-undefined
        const datetimeResults = parse(query, undefined, parsingOptions);

        const durationResult = infer(query, InputMode.Duration);

        setOptions(makeOptions(query, datetimeResults, durationResult ? [durationResult] : []) || null);
    }, 150), [setOptions, makeOptions, parsingOptions]);

    return (
        <StyledSelect
            {...selectProps}
            filterOption={null}
            isMulti={false}

            //
            placeholder={formatMessage({
                id: 'datetime_input.placeholder',
                defaultMessage: 'Select or specify a {mode, select, Duration {time span ("4 hours", "7 days"...)} DateTime {time ("in 4 hours", "May 1", "Tomorrow at 1 PM"...)} other {time or time span}}',
            }, {mode})}

            // options & value
            onInputChange={updateOptions}
            options={options ?? defaultOptions}
            value={value}
            isClearable={true}

            // styling
            maxMenuHeight={380}
            styles={customStyles}
            formatOptionLabel={OptionLabel}
        />
    );
};

const customStyles: ComponentProps<typeof Select>['styles'] = {
    control: (provided) => ({...provided, minHeight: 34}),
};

const OptionLabel = ({label, value}: Option) => label ?? (value && (
    <Timestamp
        value={value}
        {...TIME_SPEC}
    />
));

const TIME_SPEC = {
    locale: 'en',
    useDate: (_: string, {weekday, day, month, year}: any) => ({weekday, day, month, year}),
};

export const useDateTimeInput = ({defaultValue, ...props}: Partial<Exclude<Props, 'value' | 'onChange'>>) => {
    const [value, setValue] = useState<Option | null>(null);

    const input = (
        <DateTimeInput
            {...props}
            value={defaultValue ?? value}
            onChange={setValue}
        />
    );

    return {input, value};
};

export default DateTimeInput;
