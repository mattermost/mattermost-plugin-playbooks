// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useState, ComponentProps, useMemo, useEffect, ReactNode} from 'react';
import {Chrono, ParsingOption, en, nl, de, fr, ja, pt} from 'chrono-node';
import parseDuration from 'parse-duration';

import {debounce} from 'debounce';
import Select from 'react-select';

import {DateTime, Duration, DurationLikeObject, DateObjectUnits} from 'luxon';

import {useIntl} from 'react-intl';

import {StyledSelect} from 'src/components/backstage/styles';

import {Timestamp} from 'src/webapp_globals';
import {formatDuration} from 'src/components/formatted_duration';

const ChronoLocales: {[locale: string]: Pick<Chrono, 'parse' | 'parseDate'>} = {nl, de, fr, ja, pt};

export enum Mode {
    DateTimeValue = 'DateTimeValue',

    DurationValue = 'DurationValue',

    /** DateTime takes priority, or duration if parsable */
    AutoValue = 'AutoValue'
}

const chronoParsingOptions: ParsingOption = {forwardDate: true};

const durationFromQuery = (locale: string, query: string | DurationLikeObject): Duration | null => {
    if (typeof query !== 'string') {
        return Duration.fromObject(query);
    }

    localizeParseDuration(locale);

    const ms = parseDuration(query);
    return (ms && Duration.fromMillis(ms)) || null;
};

const parseDateTime = (locale: string, query: string) => {
    // eslint-disable-next-line no-undefined
    return ChronoLocales[locale.split('-')[0]]?.parseDate(query, undefined, chronoParsingOptions) ?? en.parseDate(query, undefined, chronoParsingOptions);
};
const dateTimeFromQuery = (locale: string, query: string | DateObjectUnits, acceptDurationInput = false): DateTime | null => {
    if (typeof query !== 'string') {
        return DateTime.fromObject(query);
    }

    const date = parseDateTime(locale, query);

    if (date == null && acceptDurationInput) {
        const duration = durationFromQuery(locale, query);

        if (duration?.isValid) {
            return DateTime.now().plus(duration);
        }
    }
    return (date && DateTime.fromJSDate(date)) || null;
};

export function infer(locale: string, query: string, mode?: Mode.DateTimeValue): DateTime | null;
export function infer(locale: string, query: DateObjectUnits, mode?: Mode.DateTimeValue): DateTime;

export function infer(locale: string, query: string, mode?: Mode.DurationValue): Duration | null;
export function infer(locale: string, query: DurationLikeObject, mode?: Mode.DurationValue): Duration;

export function infer(locale: string, query: string | DateObjectUnits | DurationLikeObject, mode?: Mode): Option['value'];
export function infer(locale: string, query: string | DateObjectUnits | DurationLikeObject, mode = Mode.AutoValue): Option['value'] {
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

export const useMakeOption = (mode: Mode, parseLocale?: string) => {
    const {locale} = useIntl();
    return (input: string | DateObjectUnits | DurationLikeObject, customLabel?: ReactNode): Option => {
        let label = customLabel;
        const value = infer(parseLocale ?? locale, input, mode);

        if (label == null) {
            if (DateTime.isDateTime(value)) {
                label = (
                    <Timestamp
                        value={value}
                        {...TIME_SPEC}
                    />
                );
            } else if (Duration.isDuration(value)) {
                label = formatDuration(value, 'long');
            }
        }

        return {label, value};
    };
};

export type Option = {
    value: DateTime | Duration | null;
    label?: ReactNode | null;
    mode?: Mode.DateTimeValue | Mode.DurationValue;
}

export const defaultMakeOptions: Props['makeOptions'] = (query, datetimes, durations, mode) => {
    if (!query) {
        return null;
    }

    let options: Option[] = [];

    if (datetimes.length && mode === Mode.DateTimeValue) {
        options = options.concat(datetimes.map((datetime) => ({value: datetime})));
    }

    if (durations.length) {
        if (mode === Mode.DurationValue) {
            options = options.concat(durations.map((duration) => ({value: duration, mode})));
        } else if (mode === Mode.DateTimeValue && !options.length) {
            const now = DateTime.now();
            options = options.concat(durations.map((duration) => ({value: now.plus(duration), mode})));
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

const parseDurationLocales: {[locale: string]: boolean} = {};
const localizeParseDuration = (locale: string): void => {
    if (parseDurationLocales[locale]) {
        return;
    }
    Object.entries(baseUnits).forEach(([unit, ratio]) => {
        [0, 1, 2]
            .forEach((plural) => getUnits(unit, plural, locale).forEach((unitLabel) => {
                if (unitLabel) {
                    parseDuration[unitLabel.toLowerCase().replace(/[.\s]/g, '')] = ratio;
                }
            }));
    });
    parseDurationLocales[locale] = true;
};

const baseUnits = (() => {
    const {nanosecond, microsecond, millisecond, second, minute, hour, day, week, month, year} = parseDuration;
    return {millisecond, second, minute, hour, day, week, month, year};
})();

function getUnits(unit: string, value: number, locale: string) {
    return ['narrow', 'short', 'long']
        .map((unitDisplay) => new Intl.NumberFormat(locale, {style: 'unit', unit, unitDisplay})
            .formatToParts(value).find((x) => x.type === 'unit')?.value);
}
