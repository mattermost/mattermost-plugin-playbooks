// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useUpdateEffect} from 'react-use';

import {PropertyField, PropertyValue} from 'src/types/properties';

import PropertySelectInput from './property_select_input';

import PropertyChip from './property_chip';
import EmptyState from './empty_state';

interface Props {
    field: PropertyField;
    value?: PropertyValue;
    runID: string;
    onValueChange: (value: string[] | null) => void;
}

const MultiselectProperty = (props: Props) => {
    const [isEditing, setIsEditing] = useState(false);
    const [displayValue, setDisplayValue] = useState<string[] | null>(
        Array.isArray(props.value?.value) ? props.value.value : null
    );
    const [tempValue, setTempValue] = useState<string[] | null>(null);

    useUpdateEffect(() => {
        const newValue = Array.isArray(props.value?.value) ? props.value.value : null;
        setDisplayValue(newValue);
    }, [props.value?.value]);

    const handleValueChange = (newValue: string[] | null) => {
        setTempValue(newValue);
    };

    const handleStartEdit = () => {
        setIsEditing(true);
        setTempValue(displayValue);
    };

    const handleStopEdit = () => {
        setIsEditing(false);
        if (tempValue !== null) {
            setDisplayValue(tempValue);
            props.onValueChange(tempValue);
        }
        setTempValue(null);
    };

    const selectOptions = props.field.attrs?.options?.map((option) => ({
        value: option.id,
        label: option.name,
    })) || [];

    if (isEditing) {
        return (
            <PropertySelectInput
                options={selectOptions}
                initialValue={tempValue || displayValue || undefined}
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
                    onClick={handleStartEdit}
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
