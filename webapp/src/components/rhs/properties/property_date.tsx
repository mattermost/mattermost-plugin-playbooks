// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    KeyboardEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {useUpdateEffect} from 'react-use';
import {FormattedMessage, useIntl} from 'react-intl';
import {DateTime} from 'luxon';

import {PropertyComponentProps} from 'src/types/properties';
import {DateTimeOption, DateTimeSelector, optionFromMillis} from 'src/components/datetime_selector';
import {Mode} from 'src/components/datetime_parsing';

import EmptyState from './empty_state';
import {PropertyDisplayContainer} from './property_styles';

interface Props extends PropertyComponentProps {
    onValueChange: (value: string | string[] | null) => Promise<void> | void;
}

const makeDefaultDateTimeOptions = (): DateTimeOption[] => {
    let dateTime = DateTime.now().endOf('day');
    const list: DateTimeOption[] = [];

    list.push({
        ...optionFromMillis(dateTime.toMillis(), Mode.DateTimeValue),
        label: <FormattedMessage defaultMessage='Today'/>,
    });

    dateTime = dateTime.plus({days: 1});
    list.push({
        ...optionFromMillis(dateTime.toMillis(), Mode.DateTimeValue),
        label: <FormattedMessage defaultMessage='Tomorrow'/>,
    });

    dateTime = dateTime.plus({days: 6});
    list.push({
        ...optionFromMillis(dateTime.toMillis(), Mode.DateTimeValue),
        label: <FormattedMessage defaultMessage='Next week'/>,
    });

    return list;
};

export const parsePropertyDate = (val: string | string[] | number | undefined): number => {
    if (typeof val === 'number') {
        return val;
    }
    if (Array.isArray(val)) {
        return 0;
    }
    if (typeof val === 'string' && val) {
        const iso = DateTime.fromISO(val);
        if (iso.isValid) {
            return iso.toMillis();
        }
        const num = parseInt(val, 10);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

const DateProperty = (props: Props) => {
    const {formatMessage} = useIntl();
    const [isEditing, setIsEditing] = useState(false);

    const rawValue = props.value?.value;
    const millis = parsePropertyDate(rawValue);
    const [displayMillis, setDisplayMillis] = useState<number>(millis || 0);
    const isMounted = useRef(true);
    const previousMillisRef = useRef(displayMillis);
    const callSeqRef = useRef(0);
    useEffect(() => () => {
        isMounted.current = false;
    }, []);

    useUpdateEffect(() => {
        const newRaw = props.value?.value;
        const newMillis = parsePropertyDate(newRaw);
        previousMillisRef.current = newMillis || 0;
        setDisplayMillis(newMillis || 0);
    }, [props.value?.value]);

    const handleActivateKey = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsEditing(true);
        }
    }, []);

    const handleSelectedChange = useCallback((option: DateTimeOption | undefined | null) => {
        const seq = ++callSeqRef.current;
        if (!option || !option.value) {
            const previousMillis = previousMillisRef.current;
            previousMillisRef.current = 0;
            setDisplayMillis(0);
            setIsEditing(false);
            props.onValueChange(null)?.catch(() => {
                if (isMounted.current && callSeqRef.current === seq) {
                    previousMillisRef.current = previousMillis;
                    setDisplayMillis((current) => (current === 0 ? previousMillis : current));
                }
            });
            return;
        }
        const newMillis = option.value.toMillis();
        const previousMillis = previousMillisRef.current;
        previousMillisRef.current = newMillis;
        setDisplayMillis(newMillis);
        setIsEditing(false);
        props.onValueChange(new Date(newMillis).toISOString())?.catch(() => {
            if (isMounted.current && callSeqRef.current === seq) {
                previousMillisRef.current = previousMillis;
                setDisplayMillis((current) => (current === newMillis ? previousMillis : current));
            }
        });
    }, [props.onValueChange]);

    if (isEditing) {
        return (
            <DateTimeSelector
                testId={`property-date-${props.field.id}`}
                date={displayMillis || undefined}
                mode={Mode.DateTimeValue}
                placeholder={formatMessage({id: 'playbooks.property_date.select_placeholder', defaultMessage: 'Select date...'})}
                suggestedOptions={makeDefaultDateTimeOptions()}
                onSelectedChange={handleSelectedChange}
                controlledOpenToggle={isEditing}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsEditing(false);
                    }
                }}
            />
        );
    }

    if (!displayMillis) {
        return (
            <PropertyDisplayContainer
                role='button'
                tabIndex={0}
                onClick={() => setIsEditing(true)}
                onKeyDown={handleActivateKey}
                data-testid='property-value'
            >
                <EmptyState/>
            </PropertyDisplayContainer>
        );
    }

    const formatted = DateTime.fromMillis(displayMillis).toLocaleString(DateTime.DATE_MED);

    return (
        <PropertyDisplayContainer
            role='button'
            tabIndex={0}
            onClick={() => setIsEditing(true)}
            onKeyDown={handleActivateKey}
            data-testid='property-value'
        >
            {formatted}
        </PropertyDisplayContainer>
    );
};

export default DateProperty;
