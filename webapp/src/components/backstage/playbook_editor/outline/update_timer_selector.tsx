// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import styled from 'styled-components';

import DateTimeSelector from '../../../datetime_selector';

import {
    useMakeOption,
    ms,
    Mode,
    Option,
} from 'src/components/datetime_input';

interface Props {
    seconds: number;
    setSeconds: (seconds: number) => void;
}

const UpdateTimer = (props: Props) => {
    const makeOption = useMakeOption(Mode.DurationValue);

    const defaults = useMemo(() => {
        const options = [
            makeOption({hours: 1}),
            makeOption({days: 1}),
            makeOption({days: 7}),
        ];

        let value: Option | undefined;
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

        return {options, value};
    }, [props]);

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

interface PlaceholderProps {
    label: React.ReactNode
}

export const Placeholder = (props: PlaceholderProps) => {
    return (
        <PlaceholderDiv>
            <TimeTextContainer>
                {props.label}
            </TimeTextContainer>
            <SelectorRightIcon className='icon-chevron-down icon-12'/>
        </PlaceholderDiv>
    );
};

const PlaceholderDiv = styled.div`
    display: flex;
    align-items: center;
    flex-direction: row;
    white-space: nowrap;

    &:hover {
        cursor: pointer;
    }
`;

const SelectorRightIcon = styled.i`
    font-size: 14.4px;
    &{
        margin-left: 4px;
    }
    color: var(--center-channel-color-32);
`;

const TimeTextContainer = styled.div`
    font-size: 12px;
    line-height: 15px;
    font-weight:'400';
`;