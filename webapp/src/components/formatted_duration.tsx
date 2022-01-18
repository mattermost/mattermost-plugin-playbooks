// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime, Duration, Interval, DurationUnit, DurationLike} from 'luxon';
import React from 'react';

import {useNow} from 'src/hooks';

/** See {@link Intl.RelativeTimeFormatStyle} */
type FormatStyle = Intl.NumberFormatOptions['unitDisplay'];

type TruncateBehavior = 'none' | 'truncate';

interface DurationProps {
    from: number | DateTime;

    /**
     * @default 0 - refers to now
     */
    to?: 0 | number | DateTime;
    style?: FormatStyle;
    truncate?: TruncateBehavior;
}

const label = (num: number, style: FormatStyle, narrow: string, singular: string, plural: string) => {
    if (style === 'narrow') {
        return narrow;
    }

    return num >= 2 ? plural : singular;
};

const UNITS: DurationUnit[] = ['years', 'days', 'hours', 'minutes'];

export const formatDuration = (value: DurationLike, style: FormatStyle = 'narrow', truncate: TruncateBehavior = 'none') => {
    const duration = Duration.fromDurationLike(value).shiftTo(...UNITS).normalize();

    if (duration.as('seconds') < 60) {
        switch (style) {
        case 'narrow':
            return '< 1m';
        case 'short':
            return '< 1 min';
        case 'long':
            return 'less than 1 minute';
        }
    }

    const formatUnits = truncate === 'truncate' ? [UNITS.find((unit) => duration.get(unit) > 0)!] : UNITS.filter((unit) => duration.get(unit) > 0);

    // @ts-ignore luxon 2.3 path
    if (duration.toHuman) {
        return duration
            .shiftTo(...formatUnits)
            .mapUnits(Math.floor)
            .toHuman({unitDisplay: style});
    }

    //! start:backwards-compat luxon < 2.3
    const formatParts = [];
    if (duration.years >= 1) {
        formatParts.push(`y'${label(duration.years, style, 'y', ' year', ' years')}'`);
    }
    if (duration.days >= 1) {
        formatParts.push(`d'${label(duration.days, style, 'd', ' day', ' days')}'`);
    }
    if (duration.hours >= 1) {
        formatParts.push(`h'${label(duration.hours, style, 'h', ' hour', ' hours')}'`);
    }
    if (duration.minutes >= 1) {
        formatParts.push(`m'${label(duration.minutes, style, 'm', ' minute', ' minutes')}'`);
    }

    return duration.toFormat(truncate === 'truncate' ? formatParts[0] : formatParts.join(' '));

    //! end:backwards-compat
};

const FormattedDuration = ({from, to = 0, style, truncate}: DurationProps) => {
    const now = useNow();

    if (!from) {
        return <div className='time'>{'-'}</div>;
    }

    const start = typeof from === 'number' ? DateTime.fromMillis(from) : from;
    const end = typeof to === 'number' ? DateTime.fromMillis(to || now.valueOf()) : to;
    const duration = Interval.fromDateTimes(start, end).toDuration(['years', 'days', 'hours', 'minutes']);
    return (
        <div className='time'>{formatDuration(duration, style, truncate)}</div>
    );
};

export default FormattedDuration;
