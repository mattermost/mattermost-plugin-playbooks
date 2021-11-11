// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import {Duration} from 'luxon';

import {formatDuration} from '../formatted_duration';

import {
    BackstageSubheader,
    BackstageSubheaderDescription,
    InfoLine,
} from 'src/components/backstage/styles';

import {
    useDateTimeInput,
    makeOption,
    ms,
    Mode,
    Option,
} from 'src/components/datetime_input';

interface Props {
    seconds: number;
    setSeconds: (seconds: number) => void;
}

const optionFromSeconds = (seconds: number) => {
    const duration = Duration.fromObject({seconds});

    return {
        label: formatDuration(duration, 'long'),
        value: duration,
    };
};

const DefaultUpdateTimer = (props: Props) => {
    const {formatMessage} = useIntl();

    const defaults = useMemo(() => {
        const options = [
            makeOption('60 minutes', Mode.DurationValue),
            makeOption('24 hours', Mode.DurationValue),
            makeOption('7 days', Mode.DurationValue),
        ];

        let value: Option | undefined;
        if (props.seconds) {
            value = optionFromSeconds(props.seconds);

            const matched = options.find((o) => value && ms(o.value) === ms(value.value));
            if (matched) {
                value = matched;
            } else {
                options.push(value);
            }
            options.sort((a, b) => ms(a.value) - ms(b.value));
        }

        return {options, value};
    }, [props]);

    const {input, value} = useDateTimeInput({
        mode: Mode.DurationValue,
        parsingOptions: {defaultUnit: 'minutes'},
        defaultOptions: defaults.options,
        defaultValue: defaults.value,
        isClearable: false,
        placeholder: formatMessage({defaultMessage: 'Select an option or specify a custom duration'}),
        id: 'update_timer_duration',
    });

    if (value?.value) {
        props.setSeconds(Math.floor(ms(value.value) / 1000));
    }

    return (
        <>
            <BackstageSubheader>
                {formatMessage({defaultMessage: 'Default update timer'})}
                <BackstageSubheaderDescription>
                    {formatMessage({defaultMessage: 'How often should an update be posted?'})}
                </BackstageSubheaderDescription>
            </BackstageSubheader>
            {input}
            <InfoLine>
                {formatMessage({defaultMessage: 'You can select an option or specify a custom duration ("2 weeks", "3 days 12 hours", "45 minutes", ...)'})}
            </InfoLine>
        </>
    );
};

export default DefaultUpdateTimer;
