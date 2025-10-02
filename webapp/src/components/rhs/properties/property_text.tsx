// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useUpdateEffect} from 'react-use';

import {PropertyField, PropertyValue} from 'src/types/properties';

import PropertyTextInput from './property_text_input';
import EmptyState from './empty_state';

interface Props {
    field: PropertyField;
    value?: PropertyValue;
    runID: string;
    onValueChange: (value: string | null) => void;
}

const TextProperty = (props: Props) => {
    const [isEditing, setIsEditing] = useState(false);
    const [displayValue, setDisplayValue] = useState<string | null>(
        typeof props.value?.value === 'string' ? props.value.value : null
    );

    useUpdateEffect(() => {
        const newValue = typeof props.value?.value === 'string' ? props.value.value : null;
        setDisplayValue(newValue);
    }, [props.value?.value]);

    const handleValueChange = (newValue: string | null) => {
        setDisplayValue(newValue);
        props.onValueChange(newValue);
    };

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleStopEdit = () => {
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <PropertyTextInput
                initialValue={displayValue || undefined}
                onValueChange={(value: string) => handleValueChange(value)}
                onBlur={handleStopEdit}
            />
        );
    }

    if (!displayValue) {
        return (
            <TextDisplay
                onClick={handleStartEdit}
                data-testid='property-value'
            >
                <EmptyState/>
            </TextDisplay>
        );
    }

    return (
        <TextDisplay
            onClick={handleStartEdit}
            data-testid='property-value'
        >
            {displayValue}
        </TextDisplay>
    );
};

const TextDisplay = styled.div`
    flex: 1;
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
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

export default TextProperty;
