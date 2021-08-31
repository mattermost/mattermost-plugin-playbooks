// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import luxon, {Duration, DurationUnit} from 'luxon';
import React from 'react';

import {useNow} from 'src/hooks';

/** See {@link Intl.RelativeTimeFormatStyle} */
type FormatStyle = 'long' | 'narrow';

interface DurationProps {
    from: number;
    to: number; // setting to = 0 means "now"
    ago?: boolean;
    style?: FormatStyle;
}

export const renderDuration = (value: Duration | moment.Duration, style: FormatStyle = 'narrow') => {
    const duration = Duration.isDuration(value) ? value : Duration.fromMillis(value.as('milliseconds'));

    if (duration.as('seconds') < 60) {
        return style === 'narrow' ? '< 1m' : 'less than 1 minute';
    }

    const label = (num: number, narrow: string, singular: string, plural: string) => {
        if (style === 'narrow') {
            return narrow;
        }

        return num > 1 ? plural : singular;
    };

    const formatParts = [];

    const {days, hours, minutes} = duration.shiftTo('days', 'hours', 'minutes').toObject();

    if (days) {
        formatParts.push(`d'${label(days, 'd', ' day', ' days')}'`);
    }
    if (hours) {
        formatParts.push(`h'${label(hours, 'h', ' hour', ' hours')}'`);
    }
    if (minutes) {
        formatParts.push(`m'${label(minutes, 'm', ' minute', ' minutes')}'`);
    }

    return duration.toFormat(formatParts.join(' '));
};

const DurationComponent = (props: DurationProps) => {
    const now = useNow();

    if (!props.from) {
        return <div className='time'>{'-'}</div>;
    }

    const start = moment(props.from);
    const end = (props.to && moment(props.to)) || now;
    const duration = moment.duration(end.diff(start));
    const postfix = props.ago ? ' ago' : '';
    return (
        <div className='time'>{renderDuration(duration) + postfix}</div>
    );
};

export default DurationComponent;
