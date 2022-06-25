// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useState} from 'react';
import {useIntl} from 'react-intl';

import {DateTime} from 'luxon';

import styled from 'styled-components';

import {scheduleRun} from 'src/client';
import {BaseInput} from 'src/components/assets/inputs';
import GenericModal, {InlineLabel} from 'src/components/widgets/generic_modal';
import Dropdown from 'src/components/dropdown';

import {ScheduledRun} from 'src/types/playbook_run';

const ID = 'playbooks_schedule_run_dialog';

export const makeScheduleRunDialog = (props: Props) => ({
    modalId: ID,
    dialogType: ScheduleRunDialog,
    dialogProps: props,
});

type Props = {
    scheduledRun: ScheduledRun | null;
    setScheduledRun: (createdRun: ScheduledRun | null) => void;
    playbook: {id: string, title: string};
} & Partial<ComponentProps<typeof GenericModal>>;

// w.1.mtwjfsd > every week, every day (j is for jueves and d for domingo, just to disambiguate)
// w.1.mtwjf > every week, every weekday
// w.2.mx > every two weeks, on Monday and Thursday
// m.3.28 > every three months, on the 28th
// y.1.0113 > every year, on January 13

export enum Frequency {
    Never = 'never',
    Daily = 'daily',
    Weekly = 'weekly',
    Monthly = 'monthly',
    Annually = 'annually',
    EveryWeekday = 'everyweekday'
}

export const frequencyText = (freq: Frequency, date: Date, formatMessage: any) => {
    switch (freq) {
    case Frequency.Never:
        return formatMessage({defaultMessage: 'never'});
    case Frequency.Daily:
        return formatMessage({defaultMessage: 'every day'});
    case Frequency.Weekly:
        return formatMessage({defaultMessage: 'weekly on {date, date, ::EEEE}'}, {date});
    case Frequency.Monthly:
        return formatMessage({defaultMessage: 'monthly on the {date, date, ::dd}'}, {date});
    case Frequency.Annually:
        return formatMessage({defaultMessage: 'annually on {date, date, ::MM/dd}'}, {date});
    case Frequency.EveryWeekday:
        return formatMessage({defaultMessage: 'every weekday (Monday to Friday)'});
    }

    return '';
};

const ScheduleRunDialog = ({scheduledRun, setScheduledRun, playbook, ...modalProps}: Props) => {
    const {formatMessage} = useIntl();

    const tomorrow = DateTime.now().plus({days: 1});
    const initialDateTime = scheduledRun?.first_run ?? tomorrow;

    const initialDate = () => {
        const year = String(initialDateTime.year).padStart(4, '0');
        const month = String(initialDateTime.month).padStart(2, '0');
        const day = String(initialDateTime.day).padStart(2, '0');

        return `${year}/${month}/${day}`;
    };

    const initialTime = () => {
        const hour = String(initialDateTime.hour).padStart(2, '0');
        const minute = String(initialDateTime.minute).padStart(2, '0');

        return `${hour}:${minute}`;
    };

    const [runName, setRunName] = useState(scheduledRun?.run_name || '');
    const [date, setDate] = useState(initialDate);
    const [time, setTime] = useState(initialTime);
    const [frequency, setFrequency] = useState(scheduledRun?.frequency || '');

    return (
        <DialogModal
            id={ID}
            confirmButtonText={formatMessage({defaultMessage: 'Schedule Run'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
            handleConfirm={() => {
                const schedule = DateTime.fromFormat(`${date}.${time}`, 'yyyy/MM/dd.hh:mm');
                scheduleRun(playbook.id, runName, schedule, frequency).then(setScheduledRun);
            }}
            handleCancel={() => {/**/}}
            onHide={() => {/**/}}
            isConfirmDisabled={runName === ''}
            {...modalProps}
        >
            <Title>
                {formatMessage({defaultMessage: 'Schedule playbook runs'})}
            </Title>
            <Form>
                <InlineLabel>{formatMessage({defaultMessage: 'Run name'})}</InlineLabel>
                <BaseInput
                    autoFocus={true}
                    type={'text'}
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                />
                <PlaybookName>{`Playbook: ${playbook.title}`}</PlaybookName>
                <DateTimeWrapper>
                    <DateTimeInput>
                        <InlineLabel>{formatMessage({defaultMessage: 'Date'})}</InlineLabel>
                        <InputIcon className={'icon-18 icon-calendar-outline'}/>
                        <DateInput
                            type={'text'}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </DateTimeInput>
                    <DateTimeInput>
                        <InlineLabel>{formatMessage({defaultMessage: 'Time'})}</InlineLabel>
                        <InputIcon className={'icon-18 icon-clock-outline'}/>
                        <TimeInput
                            type={'text'}
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                        />
                    </DateTimeInput>
                </DateTimeWrapper>
                <RecurringChip
                    frequency={frequency as Frequency || Frequency.Never}
                    setFrequency={setFrequency}
                    date={DateTime.fromFormat(date, 'yyyy/MM/dd')}
                />
            </Form>
        </DialogModal>
    );
};

interface RecurringChipProps {
    frequency: Frequency;
    setFrequency: (f: Frequency) => void;
    date: DateTime;
}

export const RecurringChip = (props: RecurringChipProps) => {
    const {formatMessage} = useIntl();
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const jsDate = props.date.toJSDate();
    const freq = props.frequency || Frequency.Never;

    const target = (
        <RecurringChipContainer onClick={toggleOpen}>
            {freq === Frequency.Never ? formatMessage({defaultMessage: 'Never repeats'}) : formatMessage({defaultMessage: 'Repeats {freqText}'}, {freqText: frequencyText(freq, jsDate, formatMessage)})}
            <ChevronDown className={'icon-12 icon-chevron-down'}/>
        </RecurringChipContainer>
    );

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={target}
        >
            <FrequencyMenu>
                {Object.values(Frequency).map((freqOption) => (
                    <FrequencyItem
                        key={freqOption}
                        onClick={() => {
                            props.setFrequency(freqOption);
                            toggleOpen();
                        }}
                    >
                        {frequencyText(freqOption, jsDate, formatMessage)}
                    </FrequencyItem>
                ))}
            </FrequencyMenu>
        </Dropdown>
    );
};

const FrequencyMenu = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px 0px;

    width: 268px;

    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color), 0.16);

    box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.12);
    border-radius: 4px;
`;

const FrequencyItem = styled.div`
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 400;
    font-size: 14px;

    color: var(--center-channel-color);

    width: 100%;
    padding: 6px 20px;

    cursor: pointer;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    :first-letter {
        text-transform: uppercase;
    }
`;

const RecurringChipContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 4.5px 6px 4.5px 10px;

    width: max-content;
    height: 24px;

    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 12px;

    font-weight: 600;
    font-size: 12px;

    color: var(--center-channel-color);

    cursor: pointer;
`;

const ChevronDown = styled.i`
    /* Classic - Default/32% Center Channel Text */
    color: rgba(var(--center-channel-color-rgb), 0.32);
`;

const DateTimeWrapper = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-bottom: 36px;
`;

const DateTimeInput = styled.div`
    display: flex;
    flex-direction: column;
    width: 268px;
`;

const DateInput = styled(BaseInput)`
    padding-left: 40px;
`;

const TimeInput = styled(BaseInput)`
    padding-left: 40px;
`;

const InputIcon = styled.i`
    font-weight: 400;
    font-size: 18px;

    color: rgba(var(--center-channel-color-rgb), 0.64);

    position: absolute;
    margin-top: 13px;
    margin-left: 10px;
`;

const DialogModal = styled(GenericModal)`
    width: 600px;
`;

const Title = styled.h1`
    font-family: Metropolis;
    font-size: 22px;
    margin-bottom: 28px;

    color: var(--center-channel-color);
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
`;

const PlaybookName = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin-top: 10px;
    margin-bottom: 20px;
`;
