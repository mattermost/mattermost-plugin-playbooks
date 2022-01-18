// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, ComponentProps, useMemo, useEffect} from 'react';
import {Chrono, ParsingOption, en, nl, de, fr, ja, pt} from 'chrono-node';
import parseDuration from 'parse-duration';

import {debounce} from 'debounce';
import Select from 'react-select';

import {DateTime, Duration} from 'luxon';

import {useIntl} from 'react-intl';

import {StyledSelect} from 'src/components/backstage/styles';

import {Timestamp} from 'src/webapp_globals';
import {formatDuration} from 'src/components/formatted_duration';

const ChronoLocales: {[key: string]: Pick<Chrono, 'parse' | 'parseDate'>} = {nl, de, fr, ja, pt};

export enum Mode {
    DateTimeValue = 'DateTimeValue',

    DurationValue = 'DurationValue',

    AutoValue = 'AutoValue'
}

const chronoParsingOptions: ParsingOption = {forwardDate: true};

const durationFromQuery = (locale: string, query: string): Duration | null => {
    const ms = parseDuration(query);
    return (ms && Duration.fromMillis(ms)) || null;
};

const dateTimeFromQuery = (locale: string, query: string, acceptDurationInput = false): DateTime | null => {
    // eslint-disable-next-line no-undefined
    const date: Date = ChronoLocales[locale.split('-')[0]]?.parseDate(query, undefined, chronoParsingOptions) ?? en.parseDate(query, undefined, chronoParsingOptions);
    if (date == null && acceptDurationInput) {
        const duration = durationFromQuery(locale, query);

        if (duration?.isValid) {
            return DateTime.now().plus(duration);
        }
    }
    return (date && DateTime.fromJSDate(date)) || null;
};

export function infer(locale: string, query: string, mode: Mode.DateTimeValue): DateTime | null;
export function infer(locale: string, query: string, mode: Mode.DurationValue): Duration | null;
export function infer(locale: string, query: string, mode?: Mode): Option['value'];
export function infer(locale: string, query: string, mode = Mode.AutoValue): Option['value'] {
    switch (mode) {
    case Mode.DateTimeValue:
        return dateTimeFromQuery(locale, query, true);
    case Mode.DurationValue:
        return durationFromQuery(locale, query);
    case Mode.AutoValue:
    default:
        return dateTimeFromQuery(locale, query) ?? durationFromQuery(locale, query);
    }
}

export const ms = (value: Option['value']): number => value?.valueOf() ?? 0;

export const useMakeOption = (mode = Mode.AutoValue, parseLocale?: string): (input: string, label: string) => Option => {
    const intl = useIntl();
    return useMemo(() => (input: string, label = input) => {
        return {
            label,
            value: infer(parseLocale ?? intl.locale, input, mode),
        };
    }, [mode, parseLocale]);
};

export type Option = {
    value: DateTime | Duration | null;
    label?: string | null;
    mode?: Mode.DateTimeValue | Mode.DurationValue;
}

const defaultMakeOptions: Props['makeOptions'] = (query, datetimes, durations, mode) => {
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
};

type Props = {
    mode?: Mode.DateTimeValue | Mode.DurationValue;
    onChange: (value: Option | null) => void;
    defaultOption?: Option;
    defaultOptions?: Option[];
    makeOptions?: (
        query: string,
        datetimeResults: DateTime[],
        durationResults: Duration[],
        mode: Mode,
    ) => Option[] | null;
    disabled?:boolean;
} & Partial<ComponentProps<typeof StyledSelect>>;

const DateTimeInput = ({
    mode = Mode.DateTimeValue,
    value,
    defaultOptions,
    makeOptions = defaultMakeOptions,
    isClearable = true,
    placeholder,
    disabled,
    ...selectProps
}: Props) => {
    const [options, setOptions] = useState<Option[] | null>(null);
    const {locale, formatMessage} = useIntl();

    const updateOptions = useMemo(() => debounce((query: string) => {
        const datetimes = (
            // eslint-disable-next-line no-undefined
            ChronoLocales[locale.split('-')[0]]?.parse(query, undefined, chronoParsingOptions) ??
            // eslint-disable-next-line no-undefined
            en.parse(query, undefined, chronoParsingOptions)
        ).map(({start}) => DateTime.fromJSDate(start.date()));

        const duration = infer(locale, query, Mode.DurationValue);
        setOptions(makeOptions(query, datetimes, duration ? [duration] : [], mode) || null);
    }, 150), [locale, setOptions, makeOptions]);

    return (
        <StyledSelect
            {...selectProps}
            filterOption={null}
            isMulti={false}

            //
            placeholder={placeholder ?? formatMessage({
                defaultMessage: 'Select or specify a {mode, select, DurationValue {time span ("4 hours", "7 days"...)} DateTimeValue {time ("in 4 hours", "May 1", "Tomorrow at 1 PM"...)} other {time or time span}}',
            }, {mode})}

            // options & value
            onInputChange={updateOptions}
            options={options ?? defaultOptions}
            value={value}
            isClearable={isClearable}

            // styling
            maxMenuHeight={380}
            styles={customStyles}
            formatOptionLabel={OptionLabel}
            isDisabled={disabled}
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
    return Duration.isDuration(value) && formatDuration(value, 'long');
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
