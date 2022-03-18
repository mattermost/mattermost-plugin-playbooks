// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import ReactSelect, {ActionTypes, ControlProps, StylesConfig} from 'react-select';
import styled from 'styled-components';

import {parse, ParsingOption} from 'chrono-node';

import {DateTime, Duration} from 'luxon';
import debounce from 'debounce';

import {useClientRect} from 'src/hooks';
import Dropdown from 'src/components/dropdown';

import {Timestamp} from 'src/webapp_globals';

import {defaultMakeOptions, infer, Mode, Option} from './datetime_input';

import {formatDuration} from './formatted_duration';

interface ActionObj {
    action: ActionTypes;
}

export type DateTimeOption = {
    value: DateTime | Duration | null;
    label?: string | JSX.Element | null;
    mode?: Mode.DateTimeValue | Mode.DurationValue;
    labelRHS?: JSX.Element;
}

type Props = {
    testId?: string
    date?:number
    mode?: Mode.DateTimeValue | Mode.DurationValue;
    placeholder: React.ReactNode;
    onlyPlaceholder?: boolean;
    suggestedOptions: DateTimeOption[]
    customControl?: (props: ControlProps<DateTimeOption, boolean>) => React.ReactElement;
    controlledOpenToggle?: boolean;
    onSelectedChange: (value: DateTimeOption | undefined | null) => void;
    customControlProps?: any;
    showOnRight?: boolean;
    className?: string;
    makeOptions?: (
        query: string,
        datetimeResults: DateTime[],
        durationResults: Duration[],
        mode: Mode,
    ) => Option[] | null;

}

export const optionFromMillis = (ms: number, mode: Mode.DateTimeValue | Mode.DurationValue) => ({
    value: mode === Mode.DateTimeValue ? DateTime.fromMillis(ms) : Duration.fromMillis(ms),
    mode,
});

const selectedValueOption = (value: number, mode: Mode.DateTimeValue | Mode.DurationValue) => ({
    ...optionFromMillis(value, mode),
    labelRHS: (<CheckIcon className={'icon icon-check'}/>),
});

const chronoParsingOptions: ParsingOption = {forwardDate: true};

export const DateTimeSelector = ({
    date,
    mode = Mode.DateTimeValue,
    suggestedOptions,
    makeOptions = defaultMakeOptions,
    ...props
}: Props) => {
    const {formatMessage} = useIntl();

    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    // Allow the parent component to control the open state -- only after mounting.
    const [oldOpenToggle, setOldOpenToggle] = useState(props.controlledOpenToggle);
    useEffect(() => {
        // eslint-disable-next-line no-undefined
        if (props.controlledOpenToggle !== undefined && props.controlledOpenToggle !== oldOpenToggle) {
            setOpen(!isOpen);
            setOldOpenToggle(props.controlledOpenToggle);
        }
    }, [props.controlledOpenToggle]);

    const onSelectedChange = async (value: DateTimeOption | undefined, action: ActionObj) => {
        if (action.action === 'clear') {
            props.onSelectedChange(null);
            return;
        }
        toggleOpen();
        props.onSelectedChange(value);
    };

    const optionsPlaceholder = useMemo(() => {
        const defaults = suggestedOptions;

        if (date) {
            defaults.push(selectedValueOption(date, mode));
        }
        return defaults;
    }, [date]);

    // Decide where to open the datetime selector
    const [rect, ref] = useClientRect();
    const [moveUp, setMoveUp] = useState(0);
    const [options, setOptionsDateTime] = useState<DateTimeOption[]>(optionsPlaceholder);

    useEffect(() => {
        if (!rect) {
            setMoveUp(0);
            return;
        }

        const innerHeight = window.innerHeight;
        const numProfilesShown = Math.min(6, options.length);
        const spacePerProfile = 48;
        const dropdownYShift = 27;
        const dropdownReqSpace = 80;
        const extraSpace = 10;
        const dropdownBottom = rect.top + dropdownYShift + dropdownReqSpace + (numProfilesShown * spacePerProfile) + extraSpace;
        setMoveUp(Math.max(0, dropdownBottom - innerHeight));
    }, [rect, options.length]);

    let target;
    if (props.onlyPlaceholder) {
        target = (
            <div
                onClick={toggleOpen}
            >
                {props.placeholder}
            </div>
        );
    }
    const targetWrapped = (
        <div
            data-testid={props.testId}
            ref={ref}
            className={props.className}
        >
            {target}
        </div>
    );

    const updateOptions = useMemo(() => debounce((query: string) => {
        // eslint-disable-next-line no-undefined
        const datetimes = parse(query, undefined, chronoParsingOptions).map(({start}) => DateTime.fromJSDate(start.date()));
        const duration = infer(query, Mode.DurationValue);
        let optionsNew;
        if (makeOptions) {
            optionsNew = makeOptions(query, datetimes, duration ? [duration] : [], mode) as DateTimeOption[];
        }
        setOptionsDateTime(optionsNew || optionsPlaceholder);
    }, 150), [setOptionsDateTime, makeOptions]);

    const noDropdown = {DropdownIndicator: null, IndicatorSeparator: null};
    const components = props.customControl ? {
        ...noDropdown,
        Control: props.customControl,
    } : noDropdown;

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={targetWrapped}
            showOnRight={props.showOnRight}
            moveUp={moveUp}
        >
            <ReactSelect
                isMulti={false}
                filterOption={null}
                onInputChange={updateOptions}
                autoFocus={true}
                components={components}
                controlShouldRenderValue={false}
                menuIsOpen={true}
                options={options}
                placeholder={formatMessage({defaultMessage: 'Specify date/time (“in 4 hours”, “May 1”...)'})}
                styles={selectStyles}
                onChange={onSelectedChange}
                classNamePrefix='playbook-run-user-select'
                className='playbook-run-user-select'
                formatOptionLabel={OptionLabel}
                {...props.customControlProps}
            />
        </Dropdown>
    );
};

const TIME_SPEC = {
    locale: 'en',
    useDate: (_: string, {weekday, day, month, year}: any) => ({weekday, day, month, year}),
};

const OptionLabel = ({label, value, mode, labelRHS}: DateTimeOption) => {
    if (label) {
        return (
            <Wrapper>
                {label}
                {labelRHS && <Right>{labelRHS}</Right>}
            </Wrapper>
        );
    }

    if (!value) {
        return null;
    }

    if (mode === Mode.DateTimeValue || (!mode && DateTime.isDateTime(value))) {
        const timestamp = (
            <Timestamp
                value={DateTime.isDateTime(value) ? value : DateTime.now().plus(value)}
                {...TIME_SPEC}
            />
        );
        return (
            <Wrapper>
                {timestamp}
                {labelRHS && <Right>{labelRHS}</Right>}
            </Wrapper>
        );
    }
    return Duration.isDuration(value) && formatDuration(value, 'long');
};

// styles for the select component
const selectStyles: StylesConfig<DateTimeOption, boolean> = {
    control: (provided) => ({...provided, minWidth: 240, margin: 8}),
    menu: () => ({boxShadow: 'none', width: '340px'}),
    option: (provided, state) => {
        const hoverColor = 'rgba(20, 93, 191, 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

export default DateTimeSelector;

const Wrapper = styled.div`
    display: flex;
    flex: 1;
`;

const Right = styled.div`
    flex-grow: 1;
    display: flex;
    justify-content: flex-end;
`;

const CheckIcon = styled.i`
    color: var(--button-bg);
	font-size: 22px;
`;