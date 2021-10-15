// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {SingleValueProps} from 'react-select';
import {useIntl} from 'react-intl';

import GenericModal, {Description} from 'src/components/widgets/generic_modal';
import {BaseInput} from 'src/components/assets/inputs';
import {BackstageSubheader, BackstageSubheaderDescription, StyledSelect} from 'src/components/backstage/styles';

interface Props {
    seconds: number;
    setSeconds: (seconds: number) => void;
}

const DefaultUpdateTimer = (props: Props) => {
    const [showModal, setShowModal] = useState(false);

    let customValue = 0;
    if (props.seconds !== 0 && !defaultTimerOptions.find((option) => option.value === props.seconds)) {
        customValue = props.seconds;
    }

    const timerOptions = [
        ...defaultTimerOptions,
        {label: customLabel, value: customValue},
    ];

    const {formatMessage} = useIntl();

    return (
        <>
            <BackstageSubheader>
                {formatMessage({defaultMessage: 'Default update timer'})}
                <BackstageSubheaderDescription>
                    {formatMessage({defaultMessage: 'How often should an update be posted?'})}
                </BackstageSubheaderDescription>
            </BackstageSubheader>
            <StyledSelect
                value={timerOptions.filter((option) => option.value === props.seconds)}
                onChange={(option: OptionType) => {
                    if (option?.label === customLabel) {
                        setShowModal(true);
                    } else {
                        props.setSeconds(option?.value || 0);
                    }
                }}
                classNamePrefix='channel-selector'
                options={timerOptions}
                isClearable={false}
                placeholder={'Select duration'}
                components={{SingleValue}}
            />
            <CustomDurationModal
                initialSeconds={props.seconds}
                onHide={() => setShowModal(false)}
                show={showModal}
                onSave={props.setSeconds}
            />
        </>
    );
};

type OptionType = {label: string, value: number};

const defaultTimerOptions = [
    {label: 'Never', value: 0},
    {label: '60 minutes', value: 3600},
    {label: '24 hours', value: 86400},
    {label: '7 days', value: 604800},
];

const customLabel = 'Custom duration';

const SingleValue = (props: SingleValueProps<OptionType>) => {
    if (props.data.label !== customLabel) {
        return props.data.label;
    }

    const [days, hours, minutes] = minutesToDaysHoursMinutes(Math.floor(props.data.value / 60));

    const getStr = (n : number, name: string) => (n === 0 ? '' : (`${n} ${name}${n > 1 ? 's' : ''}`));

    const daysStr = getStr(days, 'day');
    const hoursStr = getStr(hours, 'hour');
    const minutesStr = getStr(minutes, 'minute');

    return `${daysStr} ${hoursStr} ${minutesStr}`.trim();
};

const minutesToDaysHoursMinutes = (initMinutes: number) => {
    const days = Math.floor(initMinutes / (60 * 24));
    const rest = initMinutes % (60 * 24);

    const hours = Math.floor(rest / 60);
    const minutes = rest % 60;

    return [days, hours, minutes];
};

interface CustomDurationModalProps {
    initialSeconds: number;
    onHide: () => void;
    show: boolean;
    onSave: (seconds: number) => void;
}

const CustomDurationModal = (props: CustomDurationModalProps) => {
    const [initialDays, initialHours, initialMinutes] = minutesToDaysHoursMinutes(Math.floor(props.initialSeconds / 60));

    const [days, setDays] = useState(initialDays);
    const [hours, setHours] = useState(initialHours);
    const [minutes, setMinutes] = useState(initialMinutes);

    const seconds = (days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60);

    return (
        <GenericModal
            modalHeaderText={'Default update timer'}
            confirmButtonText={'Save'}
            cancelButtonText={'Cancel'}
            id={'default-update-timer'}
            handleCancel={props.onHide}
            handleConfirm={() => props.onSave(seconds)}
            show={props.show}
            autoCloseOnConfirmButton={true}
            autoCloseOnCancelButton={true}
            onHide={props.onHide}
        >
            <Description>{'How often should an update be posted?'}</Description>
            <Timer>
                <TimerInput
                    label={'Days'}
                    value={days}
                    setValue={setDays}
                />
                <TimerInput
                    label={'Hours'}
                    value={hours}
                    setValue={setHours}
                />
                <TimerInput
                    label={'Minutes'}
                    value={minutes}
                    setValue={setMinutes}
                />
            </Timer>
        </GenericModal>
    );
};

const Timer = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;

    margin-top: 24px;
`;

interface TimerInputProps {
    label: string;
    value: number;
    setValue: (value: number) => void;
}

const TimerInput = ({label, value, setValue}: TimerInputProps) => {
    return (
        <Column>
            <StyledLabel>{label}</StyledLabel>
            <StyledInput
                value={value}
                type={'number'}
                onChange={(e) => setValue(Number(e.target.value))}
            />
        </Column>
    );
};

const Column = styled.div`
    display: flex;
    flex-direction: column;
`;

const StyledLabel = styled.label`
    z-index: 1;

    width: max-content;
    margin: 0 0 -8px 12px;
    padding: 0 3px;
    background: var(--center-channel-bg);

    font-size: 10px;
    line-height: 14px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const StyledInput = styled(BaseInput)`
    width: 170px;
    height: 40px;

    font-weight: normal;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb));

    ::-webkit-inner-spin-button, ::-webkit-outer-spin-button{
        -webkit-appearance: none;
        margin: 0;
    }
    -moz-appearance: textfield;
`;

export default DefaultUpdateTimer;
