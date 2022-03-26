
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {components, ControlProps} from 'react-select';
import styled from 'styled-components';
import {DateTime} from 'luxon';

import DateTimeSelector, {DateTimeOption, optionFromMillis} from '../datetime_selector';
import {Mode} from '../datetime_input';
import {HoverMenuButton} from '../rhs/rhs_shared';

interface Props {
    date?: number;
    mode: Mode.DateTimeValue | Mode.DurationValue;
    suggestedOptions?: DateTimeOption[]

    onSelectedChange: (value?: DateTimeOption | undefined | null) => void;
}

const ControlComponentDueDate = (ownProps: ControlProps<DateTimeOption, boolean>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                <FormattedMessage defaultMessage='No due date'/>
            </ControlComponentAnchor>
        )}
    </div>
);

const DueDate = ({
    date,
    mode,
    suggestedOptions = makeDefaultDateTimeOptions(),
    ...props
}: Props) => {
    const {formatMessage} = useIntl();

    const [dateTimeSelectorToggle, setDateTimeSelectorToggle] = useState(false);
    const resetDueDate = () => {
        props.onSelectedChange();
        setDateTimeSelectorToggle(!dateTimeSelectorToggle);
    };
    return (
        <DateTimeSelector
            date={date}
            mode={mode}
            onlyPlaceholder={true}
            placeholder={
                <HoverMenuButton
                    title={formatMessage({defaultMessage: 'Add due date'})}
                    className={'icon-calendar-outline icon-16 btn-icon'}
                />
            }
            suggestedOptions={suggestedOptions}
            onSelectedChange={props.onSelectedChange}
            customControl={ControlComponentDueDate}
            customControlProps={{
                showCustomReset: Boolean(date),
                onCustomReset: resetDueDate,
            }}
            controlledOpenToggle={dateTimeSelectorToggle}
            showOnRight={true}
        />
    );
};

const makeDefaultDateTimeOptions = () => {
    let dateTime = DateTime.now();
    dateTime = dateTime.endOf('day');

    const list: DateTimeOption[] = [];
    list.push(
        {
            ...optionFromMillis(dateTime.toMillis(), Mode.DateTimeValue),
            label: <FormattedMessage defaultMessage='Today'/>,
            labelRHS: (<LabelRight>{dateTime.weekdayShort}</LabelRight>),
        }
    );

    dateTime = dateTime.plus({days: 1});
    list.push(
        {
            ...optionFromMillis(dateTime.toMillis(), Mode.DateTimeValue),
            label: <FormattedMessage defaultMessage='Tomorrow'/>,
            labelRHS: (<LabelRight>{dateTime.weekdayShort}</LabelRight>),
        }
    );

    dateTime = dateTime.plus({days: 7});
    list.push(
        {
            ...optionFromMillis(dateTime.toMillis(), Mode.DateTimeValue),
            label: <FormattedMessage defaultMessage='Next week'/>,
            labelRHS: (<LabelRight>{dateTime.toLocaleString({weekday: 'short', day: '2-digit', month: 'short'})}</LabelRight>),
        }
    );
    return list;
};

const ControlComponentAnchor = styled.a`
    display: inline-block;
    margin: 0 0 8px 12px;
    font-weight: 600;
    font-size: 12px;
    position: relative;
    top: -4px;
`;

const LabelRight = styled.div`
    font-weight: 400;
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

export default DueDate;