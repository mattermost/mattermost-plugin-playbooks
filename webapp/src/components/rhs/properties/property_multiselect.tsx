// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';
import {useUpdateEffect} from 'react-use';

import {PropertyComponentProps} from 'src/types/properties';

import PropertySelectInput from './property_select_input';

import PropertyChip from './property_chip';
import EmptyState from './empty_state';

interface Props extends PropertyComponentProps {
    onValueChange: (value: string[] | null) => Promise<void> | void;
}

const MultiselectProperty = (props: Props) => {
    const [isEditing, setIsEditing] = useState(false);
    const [displayValue, setDisplayValue] = useState<string[] | undefined>(
        Array.isArray(props.value?.value) ? props.value.value : undefined
    );
    const [tempValue, setTempValue] = useState<string[] | null | undefined>(undefined);
    const isMounted = useRef(true);
    useEffect(() => () => {
        isMounted.current = false;
    }, []);

    useUpdateEffect(() => {
        const newValue = Array.isArray(props.value?.value) ? props.value.value : undefined;
        setDisplayValue(newValue);
    }, [props.value?.value]);

    const handleValueChange = useCallback((newValue: string[] | null) => {
        setTempValue(newValue);
    }, []);

    const handleStartEdit = useCallback(() => {
        setIsEditing(true);
        setTempValue(displayValue ?? null);
    }, [displayValue]);

    const previousDisplayRef = useRef(displayValue);
    useUpdateEffect(() => {
        previousDisplayRef.current = displayValue;
    }, [displayValue]);

    const handleStopEdit = useCallback(() => {
        setIsEditing(false);
        const previousDisplay = previousDisplayRef.current;
        const committed = tempValue ?? undefined;
        previousDisplayRef.current = committed;
        setDisplayValue(committed);
        props.onValueChange(tempValue ?? null)?.catch(() => {
            if (isMounted.current) {
                previousDisplayRef.current = previousDisplay;
                setDisplayValue((current) => (current === committed ? previousDisplay : current));
            }
        });
        setTempValue(undefined);
    }, [tempValue, props.onValueChange]);

    const selectOptions = props.field.attrs?.options?.map((option) => ({
        value: option.id,
        label: option.name,
    })) || [];

    // initialValue is displayValue IF tempValue does not have a value yet (undefined when not set), but as
    // soon as it has a string[] or null, it has priority.
    const initialValue = tempValue === undefined ? displayValue : tempValue;

    if (isEditing) {
        return (
            <PropertySelectInput
                options={selectOptions}
                initialValue={initialValue || undefined}
                onValueChange={(value) => handleValueChange(Array.isArray(value) ? value : null)}
                onBlur={handleStopEdit}
                isMulti={true}
            />
        );
    }

    if (!displayValue || !Array.isArray(displayValue) || displayValue.length === 0) {
        return (
            <EmptyMultiselectDisplay
                onClick={handleStartEdit}
                role='button'
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        handleStartEdit();
                    }
                }}
                data-testid='property-value'
            >
                <EmptyState/>
            </EmptyMultiselectDisplay>
        );
    }

    return (
        <ChipsContainer data-testid='property-value'>
            {displayValue.map((id) => {
                const label = selectOptions.find((option) => option.value === id)?.label;
                return label ? (
                    <PropertyChip
                        key={id}
                        label={label}
                        onClick={handleStartEdit}
                    />
                ) : null;
            })}
        </ChipsContainer>
    );
};

const ChipsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
`;

const EmptyMultiselectDisplay = styled.div`
    flex: 1;
    cursor: pointer;
    padding: 4px 0;
    min-height: 20px;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04);
        border-radius: 4px;
        margin: 0 -4px;
        padding: 4px;
    }
`;

export default MultiselectProperty;
