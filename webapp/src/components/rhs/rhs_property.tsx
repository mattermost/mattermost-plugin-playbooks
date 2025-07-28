// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useUpdateEffect} from 'react-use';

import {PropertyField, PropertyValue} from 'src/types/property';

import {useSetRunPropertyValue} from 'src/graphql/hooks';

import PropertyDisplay from './property_display';
import PropertyTextInput from './property_text_input';
import PropertySelectInput from './property_select_input';

interface Props {
    field: PropertyField;
    value?: PropertyValue;
    runID: string;
}

const RHSProperty = (props: Props) => {
    const [isEditing, setIsEditing] = useState(false);
    const [displayValue, setDisplayValue] = useState(props.value?.value || null);
    const [setRunPropertyValue] = useSetRunPropertyValue();
    const isSelectField = props.field.type === 'select';
    const isMultiselectField = props.field.type === 'multiselect';

    // Update local display value when props change (from websocket updates)
    useUpdateEffect(() => {
        setDisplayValue(props.value?.value || null);
    }, [props.value?.value]);

    const handleValueChange = (newValue: string | string[] | null) => {
        let valueToStore: string | string[] | null;

        if (isMultiselectField && Array.isArray(newValue)) {
            // For multiselect, store the array directly (GraphQL JSON type handles it)
            valueToStore = newValue;

            // For display, store the array directly - getDisplayValue will handle the conversion
            setDisplayValue(newValue);
        } else if (typeof newValue === 'string') {
            // For single select and text, use as-is
            valueToStore = newValue;
            setDisplayValue(newValue);
        } else {
            valueToStore = null;
            setDisplayValue(null);
        }

        // GraphQL client will handle JSON encoding automatically for the JSON type
        setRunPropertyValue(props.runID, props.field.id, valueToStore);
    };

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleStopEdit = () => {
        setIsEditing(false);
    };

    const getDisplayValue = () => {
        if ((isSelectField || isMultiselectField) && displayValue) {
            const selectOptions = props.field.attrs?.options?.map((option) => ({
                value: option.data?.id || option.id,
                label: option.data?.name || option.name,
            })) || [];

            if (isMultiselectField) {
                // For multiselect fields, displayValue is always a string[] from the API
                if (Array.isArray(displayValue)) {
                    const selectedLabels = displayValue
                        .map((id) => selectOptions.find((option) => option.value === id)?.label)
                        .filter(Boolean);
                    return selectedLabels.join(', ');
                }
                return null;
            } else if (isSelectField) {
                // For select fields, find the option label
                const matchingOption = selectOptions.find((option) => option.value === displayValue);
                return matchingOption?.label;
            }
        }
        return displayValue;
    };

    const renderInput = () => {
        if (isSelectField || isMultiselectField) {
            // Convert property field options to react-select format
            // TODO: Remove .data access once Mattermost fixes PluginPropertyOption serialization
            const selectOptions = props.field.attrs?.options?.map((option) => ({
                value: option.data?.id || option.id,
                label: option.data?.name || option.name,
            })) || [];

            let initialValue = displayValue;
            if (isMultiselectField) {
                // For multiselect, displayValue is already a string[] from the API
                initialValue = Array.isArray(displayValue) ? displayValue : [];
            }

            return (
                <PropertySelectInput
                    options={selectOptions}
                    initialValue={initialValue}
                    onValueChange={handleValueChange}
                    onBlur={handleStopEdit}
                    isMulti={isMultiselectField}
                />
            );
        }

        return (
            <PropertyTextInput
                initialValue={displayValue}
                onValueChange={handleValueChange}
                onBlur={handleStopEdit}
            />
        );
    };

    return (
        <PropertyRow>
            <PropertyLabel>{props.field.name}</PropertyLabel>
            {isEditing ? (
                renderInput()
            ) : (
                <PropertyDisplay
                    value={getDisplayValue()}
                    onClick={handleStartEdit}
                />
            )}
        </PropertyRow>
    );
};

const PropertyRow = styled.div`
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    padding: 0 8px;
    margin-bottom: 12px;
`;

const PropertyLabel = styled.div`
    color: var(--center-channel-color);
    font-size: 12px;
    font-weight: 600;
    line-height: 24px;
    min-width: 120px;
    margin-right: 12px;
`;

export default RHSProperty;