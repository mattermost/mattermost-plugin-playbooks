// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React from 'react';

import {useNow} from 'src/hooks';

interface DurationProps {
    from: number;
    to: number; // setting to = 0 means "now"
    ago?: boolean;
}

export const renderDuration = (duration: moment.Duration) => {
    if (duration.asSeconds() < 60) {
        return '< 1m';
    }

    const durationComponents = [];
    if (duration.asDays() >= 1) {
        durationComponents.push(Math.floor(duration.asDays()) + 'd');
    }
    if (duration.hours() > 0) {
        durationComponents.push(duration.hours() + 'h');
    }
    if (duration.minutes() > 0) {
        durationComponents.push(duration.minutes() + 'm');
    }

    return durationComponents.join(' ');
};

const Duration = (props: DurationProps) => {
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

export default Duration;
