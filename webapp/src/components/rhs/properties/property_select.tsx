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
    onValueChange: (value: string | null) => Promise<void> | void;
}

const SelectProperty = (props: Props) => {
    const [isEditing, setIsEditing] = useState(false);
    const [displayValue, setDisplayValue] = useState<string | null>(
        typeof props.value?.value === 'string' ? props.value.value : null
    );
    const isMounted = useRef(true);
    useEffect(() => () => {
        isMounted.current = false;
    }, []);

    useUpdateEffect(() => {
        const newValue = typeof props.value?.value === 'string' ? props.value.value : null;
        setDisplayValue(newValue);
    }, [props.value?.value]);

    const handleValueChange = useCallback((newValue: string | null) => {
        const previousValue = displayValue;
        setDisplayValue(newValue);
        props.onValueChange(newValue)?.catch(() => {
            if (isMounted.current) {
                setDisplayValue((current) => (current === newValue ? previousValue : current));
            }
        });
    }, [displayValue, props.onValueChange]);

    const handleStartEdit = useCallback(() => {
        setIsEditing(true);
    }, []);

    const handleStopEdit = useCallback(() => {
        setIsEditing(false);
    }, []);

    const selectOptions = props.field.attrs?.options?.map((option) => ({
        value: option.id,
        label: option.name,
    })) || [];

    const getDisplayLabel = () => {
        if (!displayValue) {
            return undefined;
        }
        const matchingOption = selectOptions.find((option) => option.value === displayValue);
        return matchingOption?.label;
    };

    if (isEditing) {
        return (
            <PropertySelectInput
                options={selectOptions}
                initialValue={displayValue || undefined}
                onValueChange={(value) => handleValueChange(typeof value === 'string' ? value : null)}
                onBlur={handleStopEdit}
                isMulti={false}
            />
        );
    }

    const displayLabel = getDisplayLabel();
    if (!displayLabel) {
        return (
            <EmptySelectDisplay
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
            </EmptySelectDisplay>
        );
    }

    return (
        <PropertyChip
            label={displayLabel}
            onClick={handleStartEdit}
            data-testid='property-value'
        />
    );
};

const EmptySelectDisplay = styled.div`
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

export default SelectProperty;
