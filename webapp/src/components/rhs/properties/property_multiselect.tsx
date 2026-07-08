// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useUpdateEffect} from 'react-use';

import {PropertyField, PropertyValue} from 'src/types/properties';

import PropertySelectInput from './property_select_input';

import PropertyChip from './property_chip';
import EmptyState from './empty_state';
import {readOnlyInteractiveStyles} from './property_styles';

interface Props {
    field: PropertyField;
    value?: PropertyValue;
    runID: string;
    readOnly?: boolean;
    onValueChange: (value: string[] | null) => void;
}

const MultiselectProperty = (props: Props) => {
    const [isEditing, setIsEditing] = useState(false);
    const [displayValue, setDisplayValue] = useState<string[] | undefined>(
        Array.isArray(props.value?.value) ? props.value.value : undefined
    );
    const [tempValue, setTempValue] = useState<string[] | null | undefined>(undefined);

    useUpdateEffect(() => {
        const newValue = Array.isArray(props.value?.value) ? props.value.value : undefined;
        setDisplayValue(newValue);
    }, [props.value?.value]);

    const handleValueChange = (newValue: string[] | null) => {
        setTempValue(newValue);
    };

    const handleStartEdit = () => {
        if (props.readOnly) {
            return;
        }
        setIsEditing(true);
        setTempValue(displayValue ?? null);
    };

    const handleStopEdit = () => {
        setIsEditing(false);
        setDisplayValue(tempValue ?? undefined);
        props.onValueChange(tempValue ?? null);
        setTempValue(undefined);
    };

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
                $readOnly={props.readOnly}
                data-testid='property-value'
            >
                <EmptyState/>
            </EmptyMultiselectDisplay>
        );
    }

    const selectedLabels = displayValue
        .map((id) => selectOptions.find((option) => option.value === id)?.label)
        .filter(Boolean);

    return (
        <ChipsContainer data-testid='property-value'>
            {selectedLabels.map((label, index) => (
                <PropertyChip
                    key={index}
                    label={label!}
                    onClick={props.readOnly ? undefined : handleStartEdit}
                />
            ))}
        </ChipsContainer>
    );
};

const ChipsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
`;

const EmptyMultiselectDisplay = styled.div<{$readOnly?: boolean}>`
    flex: 1;
    padding: 4px 0;
    min-height: 20px;

    ${readOnlyInteractiveStyles}
`;

export default MultiselectProperty;
