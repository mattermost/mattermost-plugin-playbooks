// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, ComponentProps, useMemo, useEffect} from 'react';
import styled from 'styled-components';
import {parse, parseDate, ParsingOption} from 'chrono-node';
import parseDuration from 'parse-duration';

import {debounce} from 'debounce';
import Select from 'react-select';

import {DateTime, Duration} from 'luxon';

import {useIntl} from 'react-intl';

import {Timestamp} from 'src/webapp_globals';
import {renderDuration} from 'src/components/duration';

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

export enum Mode {
    DateTimeValue = 'DateTimeValue',

    DurationValue = 'DurationValue',

    AutoValue = 'AutoValue'
}

const chronoParsingOptions: ParsingOption = {forwardDate: true};

const durationFromQuery = (query: string): Duration | null => {
    const ms = parseDuration(query);
    return (ms && Duration.fromMillis(ms)) || null;
};

const dateTimeFromQuery = (query: string, acceptDurationInput = false): DateTime | null => {
    // eslint-disable-next-line no-undefined
    const date: Date = parseDate(query, undefined, chronoParsingOptions);
    if (date == null && acceptDurationInput) {
        const duration = durationFromQuery(query);

        if (duration?.isValid) {
            return DateTime.now().plus(duration);
        }
    }
    return (date && DateTime.fromJSDate(date)) || null;
};

export function infer(query: string, mode: Mode.DateTimeValue): DateTime | null;
export function infer(query: string, mode: Mode.DurationValue): Duration | null;
export function infer(query: string, mode?: Mode): Option['value'];
export function infer(query: string, mode = Mode.AutoValue): Option['value'] {
    switch (mode) {
    case Mode.DateTimeValue:
        return dateTimeFromQuery(query, true);
    case Mode.DurationValue:
        return durationFromQuery(query);
    case Mode.AutoValue:
    default:
        return dateTimeFromQuery(query) ?? durationFromQuery(query);
    }
}

export const ms = (value: Option['value']): number => value?.valueOf() ?? 0;

export const makeOption = (input: string, mode = Mode.AutoValue): Option => ({
    label: input,
    value: infer(input, mode),
});
export type Option = {
    value: DateTime | Duration | null;
    label?: string | null;
    mode?: Mode.DateTimeValue | Mode.DurationValue;
} | {
    value: Duration | null;
    label: string;
    mode?: Mode.DurationValue;
}

type Props = {
    mode?: Mode.DateTimeValue | Mode.DurationValue;
    onChange: (value: Option | null) => void;
    defaultOption?: Option;
    defaultOptions?: Option[];
    makeOptions?: (
        query: string,
        datetimeResults: DateTime[],
        durationResults: Duration[],
    ) => Option[] | null;
} & Partial<ComponentProps<typeof StyledSelect>>;

const DateTimeInput = ({
    mode = Mode.DateTimeValue,
    value,
    defaultOptions,
    makeOptions = (query, datetimes, durations) => {
        if (!query) {
            return null;
        }

        let options: Option[] = [];

        if (datetimes.length && mode === Mode.DateTimeValue) {
            options = options.concat(datetimes.map((datetime) => ({value: datetime})));
        }

        if (durations.length) {
            if (
                mode === Mode.DurationValue ||
                (mode === Mode.DateTimeValue && !options.length)
            ) {
                options = options.concat(durations.map((duration) => ({value: duration, mode})));
            }
        }

        return options;
    },

    ...selectProps
}: Props) => {
    const [options, setOptions] = useState<Option[] | null>(null);
    const {formatMessage} = useIntl();

    const updateOptions = useMemo(() => debounce((query: string) => {
        // eslint-disable-next-line no-undefined
        const datetimes = parse(query, undefined, chronoParsingOptions).map(({start}) => DateTime.fromJSDate(start.date()));
        const duration = infer(query, Mode.DurationValue);
        setOptions(makeOptions(query, datetimes, duration ? [duration] : []) || null);
    }, 150), [setOptions, makeOptions]);

    return (
        <StyledSelect
            {...selectProps}
            filterOption={null}
            isMulti={false}

            //
            placeholder={formatMessage({
                id: 'datetime_input.placeholder',
                defaultMessage: 'Select or specify a {mode, select, DurationValue {time span ("4 hours", "7 days"...)} DateTimeValue {time ("in 4 hours", "May 1", "Tomorrow at 1 PM"...)} other {time or time span}}',
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

const TIME_SPEC = {
    locale: 'en',
    useDate: (_: string, {weekday, day, month, year}: any) => ({weekday, day, month, year}),
};

const OptionLabel = ({label, value, mode}: Option) => {
    if (label) {
        return label;
    }

    if (!value) {
        return null;
    }

    if (mode === Mode.DateTimeValue || (!mode && DateTime.isDateTime(value))) {
        return (
            <Timestamp
                value={DateTime.isDateTime(value) ? value : DateTime.now().plus(value)}
                {...TIME_SPEC}
            />
        );
    }
    return Duration.isDuration(value) && renderDuration(value, 'long');
};

export const useDateTimeInput = ({defaultValue, ...props}: Partial<Exclude<Props, 'value' | 'onChange'>>) => {
    const [value, setValue] = useState<Option | null>();

    useEffect(() => {
        // eslint-disable-next-line no-undefined
        if (value === undefined) {
            setValue(defaultValue);
        }
    }, [defaultValue]);

    const input = (
        <DateTimeInput
            {...props}
            value={value}
            onChange={setValue}
        />
    );

    return {input, value};
};

export default DateTimeInput;
