
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {components, ControlProps} from 'react-select';
import styled, {css} from 'styled-components';
import {DateTime} from 'luxon';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import DateTimeSelector, {DateTimeOption, optionFromMillis} from '../datetime_selector';
import {Mode} from '../datetime_input';
import {HoverMenuButton} from '../rhs/rhs_shared';
import {Timestamp} from 'src/webapp_globals';
import {FutureTimeSpec, PastTimeSpec} from '../rhs/rhs_post_update';
import {useAllowSetTaskDueDate} from 'src/hooks';
import UpgradeModal from 'src/components/backstage/upgrade_modal';

import {AdminNotificationType, OVERLAY_DELAY} from 'src/constants';

interface Props {
    date?: number;
    mode: Mode.DateTimeValue | Mode.DurationValue;
    editable?: boolean;

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

export const DueDateHoverMenuButton = ({
    date,
    mode,
    ...props
}: Props) => {
    const {formatMessage} = useIntl();
    const dueDateEditAvailable = useAllowSetTaskDueDate();

    const suggestedOptions = makeDefaultDateTimeOptions();
    if (date) {
        suggestedOptions.push(selectedValueOption(date, mode));
    }

    const licenseControl = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
        if (!dueDateEditAvailable) {
            e.stopPropagation();
        }
    };
    const [dateTimeSelectorToggle, setDateTimeSelectorToggle] = useState(false);
    const resetDueDate = () => {
        props.onSelectedChange();
        setDateTimeSelectorToggle(!dateTimeSelectorToggle);
    };

    const hoverMenuButton = (
        <HoverMenuButton
            disabled={!dueDateEditAvailable}
            title={dueDateEditAvailable ? formatMessage({defaultMessage: 'Add due date'}) : ''}
            className={'icon-calendar-outline icon-16 btn-icon'}
            onClick={licenseControl}
        />
    );

    const toolTip = formatMessage({defaultMessage: 'Due date (Available in the Professional plan)'});

    // if feature is not available display license info on hover
    const placeholder = dueDateEditAvailable ? (
        hoverMenuButton
    ) : (
        <OverlayTrigger
            placement='top'
            delay={OVERLAY_DELAY}
            shouldUpdatePosition={true}
            overlay={<Tooltip id='due-date-tooltip'>{toolTip}</Tooltip>}
        >
            {hoverMenuButton}
        </OverlayTrigger>
    );
    return (
        <DateTimeSelector
            date={date}
            mode={mode}
            onlyPlaceholder={true}
            placeholder={placeholder}
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

export const DueDateButton = ({
    date,
    mode,
    ...props
}: Props) => {
    const {formatMessage} = useIntl();
    const dueDateEditAvailable = useAllowSetTaskDueDate();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showOnRight, setShowOnRight] = useState(false);
    const ref = useRef<any>(null);

    useEffect(() => {
        // depending on component left offset decide where to show popup
        setShowOnRight(ref.current.offsetLeft > 50);
    }, [props.editable]);

    const suggestedOptions = makeDefaultDateTimeOptions();
    if (date) {
        suggestedOptions.push(selectedValueOption(date, mode));
    }

    const handleButtonClick = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
        if (!props.editable) {
            e.stopPropagation();
            return;
        }

        if (!dueDateEditAvailable) {
            e.stopPropagation();
            setShowUpgradeModal(true);
        }
    };

    const [dateTimeSelectorToggle, setDateTimeSelectorToggle] = useState(false);
    const resetDueDate = () => {
        props.onSelectedChange();
        setDateTimeSelectorToggle(!dateTimeSelectorToggle);
    };

    const upgradeModal = (
        <UpgradeModal
            messageType={AdminNotificationType.CHECKLIST_ITEM_DUE_DATE}
            show={showUpgradeModal}
            onHide={() => setShowUpgradeModal(false)}
        />
    );

    const dueUntilToday = isDueUntilToday(date);
    const label = buttonLabel(date);

    const dueDateButton = (
        <DueDateContainer
            ref={ref}
            dueUntilToday={dueUntilToday}
        >
            <DateTimeSelector
                placeholder={
                    <PlaceholderDiv
                        onClick={handleButtonClick}
                        data-testid='due-date-info-button'
                    >
                        <CalendarIcon
                            className={'icon-calendar-outline icon-14 btn-icon'}
                            dueUntilToday={dueUntilToday}
                        />
                        <DueDateTextContainer
                            editable={props.editable}
                            dueUntilToday={dueUntilToday}
                        >
                            {label}
                        </DueDateTextContainer>
                        {props.editable && <SelectorRightIcon className='icon-chevron-down icon-14'/>}
                    </PlaceholderDiv>
                }

                date={date}
                mode={mode}
                onlyPlaceholder={true}
                suggestedOptions={suggestedOptions}
                onSelectedChange={props.onSelectedChange}
                customControl={ControlComponentDueDate}
                customControlProps={{
                    showCustomReset: Boolean(date),
                    onCustomReset: resetDueDate,
                }}
                controlledOpenToggle={dateTimeSelectorToggle}
                showOnRight={showOnRight}
            />
            {upgradeModal}
        </DueDateContainer>
    );

    const dateInfo = date ? DateTime.fromMillis(date).toLocaleString({month: 'short', day: '2-digit'}) : '';
    const toolTip = formatMessage({defaultMessage: 'Due on {date}'}, {date: dateInfo});

    return (
        (date && !props.editable) ? (
            <OverlayTrigger
                placement='bottom'
                delay={OVERLAY_DELAY}
                shouldUpdatePosition={true}
                overlay={<Tooltip id='due-date-tooltip'>{toolTip}</Tooltip>}
            >
                {dueDateButton}
            </OverlayTrigger>
        ) : dueDateButton
    );
};

const buttonLabel = (date?: number) => {
    if (!date) {
        return <FormattedMessage defaultMessage='Add due date'/>;
    }

    const timespec = (date < DateTime.now().toMillis()) ? PastTimeSpec : FutureTimeSpec;
    const timestamp = DateTime.fromMillis(date);
    return (
        <>
            {<FormattedMessage defaultMessage='Due'/>}
            {' '}
            <Timestamp
                value={timestamp.toJSDate()}
                units={timespec}
                useTime={false}
            />
        </>
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

    // plus only 6 because earlier we did plus 1
    dateTime = dateTime.plus({days: 6});
    list.push(
        {
            ...optionFromMillis(dateTime.toMillis(), Mode.DateTimeValue),
            label: <FormattedMessage defaultMessage='Next week'/>,
            labelRHS: (<LabelRight>{dateTime.toLocaleString({weekday: 'short', day: '2-digit', month: 'short'})}</LabelRight>),
        }
    );
    return list;
};

const selectedValueOption = (value: number, mode: Mode.DateTimeValue | Mode.DurationValue) => ({
    ...optionFromMillis(value, mode),
    labelRHS: (<CheckIcon className={'icon icon-check'}/>),
});

const isDueUntilToday = (date?: number) => {
    if (!date) {
        return false;
    }
    const dueDate = DateTime.fromMillis(date);
    const now = DateTime.now();
    const dueToday = now.day === dueDate.day && now.year === dueDate.year && now.month === dueDate.month;
    const overdue = date < now.toMillis();
    return dueToday || overdue;
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

const CheckIcon = styled.i`
    color: var(--button-bg);
	font-size: 22px;
`;

const PlaceholderDiv = styled.div`
    display: flex;
    align-items: center;
    flex-direction: row;
    white-space: nowrap;  
`;

const DueDateTextContainer = styled.div<{editable?: boolean, dueUntilToday: boolean}>`
    font-size: 12px;
    line-height: 15px;

    font-weight:  ${(props) => (props.dueUntilToday || props.editable ? '600' : '400')};
`;

const CalendarIcon = styled.div<{dueUntilToday: boolean}>`
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    text-align: center;
    flex: table;
    margin-right: 5px;
    color: inherit;
    pointer-events: none;

    ${({dueUntilToday}) => !dueUntilToday && `
        color: rgba(var(--center-channel-color-rgb), 0.56);
    `}
`;

const SelectorRightIcon = styled.i`
    font-weight: 400;
    font-size: 14.4px;
    line-height: 14px;
    margin-left: 4px;
`;

const DueDateContainer = styled.div<{dueUntilToday: boolean}>`
    display: flex;  
    flex-wrap: wrap;

    border-radius: 13px;
    padding: 2px 8px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    max-width: 100%;

    ${({dueUntilToday}) => (dueUntilToday ? css`
        background-color: rgba(var(--dnd-indicator-rgb), 0.08);
        color: var(--dnd-indicator);
    ` : css`
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
    `)}
`;
