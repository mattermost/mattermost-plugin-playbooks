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

import PropertyTextInput from './property_text_input';
import EmptyState from './empty_state';
import {PropertyDisplayContainer} from './property_styles';

interface Props extends PropertyComponentProps {
    onValueChange: (value: string | null) => Promise<void> | void;
}

const isSafeUrl = (url: string): boolean => {
    const normalized = url.trim().toLowerCase();
    return normalized.startsWith('http://') || normalized.startsWith('https://');
};

const TextProperty = (props: Props) => {
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

    if (isEditing) {
        return (
            <PropertyTextInput
                initialValue={displayValue || undefined}
                onValueChange={(value: string) => handleValueChange(value)}
                onBlur={handleStopEdit}
            />
        );
    }

    let content: React.ReactNode;

    if (!displayValue) {
        content = <EmptyState/>;
    } else if (props.field.attrs?.value_type === 'url') {
        content = (
            <URLLink
                href={isSafeUrl(displayValue) ? displayValue : '#'}
                target='_blank'
                rel='noopener noreferrer'
                onClick={(e) => e.stopPropagation()}
            >
                {displayValue}
            </URLLink>
        );
    } else {
        content = displayValue;
    }

    return (
        <PropertyDisplayContainer
            onClick={handleStartEdit}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleStartEdit();
                }
            }}
            data-testid='property-value'
        >
            {content}
        </PropertyDisplayContainer>
    );
};


const URLLink = styled.a`
    color: var(--button-bg);
    text-decoration: none;
    word-break: break-all;

    &:hover {
        text-decoration: underline;
    }

    &:visited {
        color: var(--button-bg);
    }
`;

export default TextProperty;
