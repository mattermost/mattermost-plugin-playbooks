// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import DateTimeSelector from 'src/components/datetime_selector';

import {
    Mode,
    Option,
    ms,
    useMakeOption,
} from 'src/components/datetime_input';

import {Placeholder} from 'src/components/backstage/playbook_editor/outline/section_status_updates';

interface Props {
    seconds: number;
    setSeconds: (seconds: number) => void;
}

const UpdateTimer = (props: Props) => {
    const {formatMessage} = useIntl();
    const makeOption = useMakeOption(Mode.DurationValue);

    const defaults = useMemo(() => {
        const neverOption: Option = {value: null, label: formatMessage({defaultMessage: 'Never'})};
        const options = [
            makeOption({hours: 1}),
            makeOption({days: 1}),
            makeOption({days: 7}),
        ];

        let value: Option | undefined = neverOption;
        if (props.seconds) {
            value = makeOption({seconds: props.seconds});

            const matched = options.find((o) => value && ms(o.value) === ms(value.value));
            if (matched) {
                value = matched;
            } else {
                options.push(value);
            }
            options.sort((a, b) => ms(a.value) - ms(b.value));
        }

        // "Never" leads the list as the "no reminder" choice; it is kept out of the
        // duration sort above so a null value (ms 0) does not interleave with real durations.
        options.unshift(neverOption);

        return {options, value};
    }, [props.seconds, formatMessage]);

    return (
        <DateTimeSelector
            placeholder={<Placeholder label={defaults.value?.label}/>}
            date={props.seconds}
            mode={Mode.DurationValue}
            onlyPlaceholder={true}
            suggestedOptions={defaults.options}
            onSelectedChange={(value) => {
                props.setSeconds((value?.value?.toMillis() || 0) / 1000);
            }}
        />
    );
};

export default UpdateTimer;
