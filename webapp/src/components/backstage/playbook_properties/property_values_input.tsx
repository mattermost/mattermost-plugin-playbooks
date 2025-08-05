// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    type FocusEventHandler,
    type KeyboardEventHandler,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {components} from 'react-select';
import CreatableSelect, {type CreatableProps} from 'react-select/creatable';
import styled from 'styled-components';

import {MinusIcon} from '@mattermost/compass-icons/components';

import type {PropertyField} from 'src/types/property_field';

type Props = {
    field: PropertyField;
    updateField: (field: PropertyField) => void;
};

type Option = {label: string; id: string; value: string};
type SelectProps = CreatableProps<Option, true> & {
    components?: any;
    styles?: any;
};

const PropertyValuesInput = ({
    field,
    updateField,
}: Props) => {
    const {formatMessage} = useIntl();

    const [query, setQuery] = React.useState('');
    const [showLastOptionError, setShowLastOptionError] = React.useState(false);
    const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isQueryValid = useMemo(() => !checkForDuplicates(field.attrs.options, query.trim()), [field.attrs.options, query]);

    useEffect(() => {
        return () => {
            if (errorTimeoutRef.current) {
                clearTimeout(errorTimeoutRef.current);
            }
        };
    }, []);

    const addValue = (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return;
        }

        const currentOptions = field.attrs.options || [];
        const newOption = {
            id: `option-${Date.now()}`,
            name: trimmedName,
        };
        updateField({
            ...field,
            attrs: {
                ...field.attrs,
                options: [...currentOptions, newOption],
            },
        });
    };

    const setFieldOptions = (options: Array<{id: string; name: string; color?: string}>) => {
        updateField({
            ...field,
            attrs: {
                ...field.attrs,
                options,
            },
        });
    };

    const processQuery = (newQuery: string) => {
        addValue(newQuery);
        setQuery('');
    };

    const handleKeyDown: KeyboardEventHandler = (event) => {
        if (!query || !isQueryValid) {
            return;
        }

        switch (event.key) {
        case 'Enter':
        case 'Tab':
            processQuery(query);
            event.preventDefault();
        }
    };

    const handleOnBlur: FocusEventHandler = (event) => {
        if (!query || !isQueryValid) {
            return;
        }

        processQuery(query);
        event.preventDefault();
    };

    if (field.type !== 'multiselect' && field.type !== 'select') {
        return (
            <Container>
                <MinusIcon size={16}/>
            </Container>
        );
    }

    return (
        <Container>
            <CreatableSelect<Option, true>
                components={customComponents}
                inputValue={query}
                isClearable={true}
                isMulti={true}
                menuIsOpen={false}
                onChange={(newValues) => {
                    if (!newValues) {
                        return;
                    }

                    // Prevent removing the last option
                    if (newValues.length === 0 && (field.attrs.options?.length || 0) > 0) {
                        setShowLastOptionError(true);

                        // Clear any existing timeout
                        if (errorTimeoutRef.current) {
                            clearTimeout(errorTimeoutRef.current);
                        }

                        // Set new timeout
                        errorTimeoutRef.current = setTimeout(() => {
                            setShowLastOptionError(false);
                            errorTimeoutRef.current = null;
                        }, 3000);
                        return;
                    }

                    const options = newValues.map(({value, id}) => ({
                        id: id || `option-${Date.now()}`,
                        name: value,
                    }));
                    setFieldOptions(options);
                }}
                onInputChange={(newValue) => setQuery(newValue)}
                onKeyDown={handleKeyDown}
                onBlur={handleOnBlur}
                placeholder={formatMessage({
                    defaultMessage: 'Add values…',
                })}
                value={field.attrs.options?.map((option) => ({
                    label: option.name,
                    value: option.name,
                    id: option.id,
                })) || []}
                styles={styles}
            />
            {!isQueryValid && (
                <ErrorText>
                    <FormattedMessage
                        defaultMessage='Values must be unique.'
                    />
                </ErrorText>
            )}
            {showLastOptionError && (
                <ErrorText>
                    <FormattedMessage
                        defaultMessage='Cannot remove the last option. Add another option first.'
                    />
                </ErrorText>
            )}
        </Container>
    );
};

const checkForDuplicates = (options: Array<{id: string; name: string; color?: string}> | undefined, newValue: string) => {
    return options?.some((option) => option.name === newValue);
};

const customComponents: SelectProps['components'] = {
    DropdownIndicator: undefined,
    ClearIndicator: undefined,
    IndicatorsContainer: () => null,
    Input: (props: any) => {
        return (
            <components.Input
                {...props}
                maxLength={255}
            />
        );
    },
};

const styles: SelectProps['styles'] = {
    multiValue: (base: any) => ({
        ...base,
        borderRadius: '12px',
        paddingLeft: '6px',
        paddingTop: '1px',
        paddingBottom: '1px',
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
    }),
    multiValueLabel: (base: any) => ({
        ...base,
        color: 'var(--center-channel-color)',
        fontFamily: 'Open Sans',
        fontSize: '12px',
        fontStyle: 'normal',
        fontWeight: 600,
        lineHeight: '16px',
    }),
    multiValueRemove: (base: any) => ({
        ...base,
        cursor: 'pointer',
        color: 'var(--center-channel-color)',
        borderRadius: '0 12px 12px 0',
        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
            color: 'var(--center-channel-color)',
        },
    }),
    control: (base: any, props: any) => ({
        ...base,
        minHeight: '40px',
        overflowY: 'auto',
        border: 'none',
        borderRadius: '0',
        background: 'transparent',
        ...props.isFocused && {
            border: 'none',
            boxShadow: 'none',
            background: 'rgba(var(--button-bg-rgb), 0.08)',
        },
        '&:hover': {
            background: 'rgba(var(--button-bg-rgb), 0.08)',
            cursor: 'text',
        },
    }),
};

const Container = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 8px 12px;
`;

const ErrorText = styled.div`
    margin-top: 4px;
    color: var(--error-text);
    font-size: 12px;
    line-height: 16px;
`;

export default PropertyValuesInput;
