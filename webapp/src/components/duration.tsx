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

    if (!props.created_at) {
        return <div className='time'>{'-'}</div>;
    }

    const start = moment(props.created_at);
    const end = (props.ended_at && moment(props.ended_at)) || now;
    const duration = moment.duration(end.diff(start));

    return (
        <div className='time'>{renderDuration(duration)}</div>
    );
};

export default Duration;
