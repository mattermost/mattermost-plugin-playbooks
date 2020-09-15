// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState} from 'react';
import moment from 'moment';

interface DurationProps {
    created_at: number;
    ended_at: number;
}

const Duration: FC<DurationProps> = (props: DurationProps) => {
    const [now, setNow] = useState(moment());

    useEffect(() => {
        const tick = () => {
            setNow(moment());
        };
        const quarterSecond = 250;
        const timerId = setInterval(tick, quarterSecond);

        return () => {
            clearInterval(timerId);
        };
    }, []);

    const start = moment(props.created_at);
    const end = (props.ended_at && moment(props.ended_at)) || now;

    const duration = moment.duration(end.diff(start));
    let durationString = '';
    if (duration.days() > 0) {
        durationString += duration.days() + 'd ';
    }
    if (duration.hours() > 0) {
        durationString += duration.hours() + 'h ';
    }
    if (duration.minutes() > 0) {
        durationString += duration.minutes() + 'm ';
    }
    durationString += duration.seconds() + 's';

    return (
        <div className='first-title'>
            {'Duration'}
            <div className='time'>{durationString}</div>
        </div>
    );
};

export default Duration;
