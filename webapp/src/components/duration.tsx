// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState} from 'react';
import moment from 'moment';

interface DurationProps {
    created_at: number;
    ended_at: number;
}

export const renderDuration = (duration: moment.Duration) => {
    if (duration.asSeconds() < 60) {
        return '< 1m';
    }

    const durationComponents = [];
    if (duration.days() > 0) {
        durationComponents.push(duration.days() + 'd');
    }
    if (duration.hours() > 0) {
        durationComponents.push(duration.hours() + 'h');
    }
    if (duration.minutes() > 0) {
        durationComponents.push(duration.minutes() + 'm');
    }

    return durationComponents.join(' ');
};

const Duration: FC<DurationProps> = (props: DurationProps) => {
    const [now, setNow] = useState(moment());

    useEffect(() => {
        const tick = () => {
            setNow(moment());
        };
        const everySecond = 1000;
        const timerId = setInterval(tick, everySecond);

        return () => {
            clearInterval(timerId);
        };
    }, []);

    const start = moment(props.created_at);
    const end = (props.ended_at && moment(props.ended_at)) || now;
    const duration = moment.duration(end.diff(start));

    return (
        <div className='first-title'>
            {'Duration'}
            <div className='time'>{renderDuration(duration)}</div>
        </div>
    );
};

export default Duration;
