// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime, Duration, Interval} from 'luxon';
import React from 'react';

import {useNow} from 'src/hooks';

/** See {@link Intl.RelativeTimeFormatStyle} */
type FormatStyle = 'long' | 'narrow';

interface DurationProps {
    from: number | DateTime;

    /**
     * @default 0 - refers to now
     */
    to?: 0 | number | DateTime;
    ago?: boolean;
    style?: FormatStyle;
}

const label = (num: number, style: FormatStyle, narrow: string, singular: string, plural: string) => {
    if (style === 'narrow') {
        return narrow;
    }

    return num >= 2 ? plural : singular;
};

export const formatDuration = (value: Duration, style: FormatStyle = 'narrow') => {
    const duration = value.shiftTo('years', 'days', 'hours', 'minutes');

    if (duration.as('seconds') < 60) {
        return style === 'narrow' ? '< 1m' : 'less than 1 minute';
    }

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

    return duration.toFormat(formatParts.join(' '));
};

const FormattedDuration = ({from, to = 0, ago, style}: DurationProps) => {
    const now = useNow();

    if (!from) {
        return <div className='time'>{'-'}</div>;
    }

    const start = typeof from === 'number' ? DateTime.fromMillis(from) : from;
    const end = typeof to === 'number' ? DateTime.fromMillis(to || now.valueOf()) : to;
    const duration = Interval.fromDateTimes(start, end).toDuration(['years', 'days', 'hours', 'minutes']);
    const postfix = ago ? ' ago' : '';
    return (
        <div className='time'>{formatDuration(duration, style) + postfix}</div>
    );
};

export default FormattedDuration;
