// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';

import {PropertyField} from 'src/types/properties';
import {ConditionExprV1} from 'src/types/conditions';

interface InlineConditionEditorProps {
    propertyFields: PropertyField[];
    onSave: (expr: ConditionExprV1) => void;
    onCancel: () => void;
}

const InlineConditionEditor = ({
    propertyFields,
    onSave,
    onCancel,
}: InlineConditionEditorProps) => {
    const {formatMessage} = useIntl();
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [selectedOperator, setSelectedOperator] = useState<'is' | 'isNot'>('is');
    const [conditionValue, setConditionValue] = useState<string | string[]>('');

    const selectedProperty = propertyFields.find((prop) => prop.id === selectedFieldId);
    const isSelectField = selectedProperty?.type === 'select' || selectedProperty?.type === 'multiselect';

    const hasValidValue = () => {
        if (Array.isArray(conditionValue)) {
            return conditionValue.length > 0;
        }
        return Boolean(conditionValue);
    };

    const handleSave = () => {
        if (!selectedFieldId || !hasValidValue()) {
            return;
        }

        const conditionExpr: ConditionExprV1 = {
            [selectedOperator]: {
                field_id: selectedFieldId,
                value: conditionValue,
            },
        };

        onSave(conditionExpr);
    };

    // Get available property fields (status, text, select, multiselect)
    const availableFields = propertyFields.filter(
        (field) => field.type === 'text' || field.type === 'select' || field.type === 'multiselect'
    );

    return (
        <EditorContainer onClick={(e) => e.stopPropagation()}>
            <EditorHeader>
                <FormattedMessage defaultMessage='Add Conditional'/>
            </EditorHeader>
            <EditorBody>
                <FormRow>
                    <FormLabel>
                        <FormattedMessage defaultMessage='Field:'/>
                    </FormLabel>
                    <Select
                        value={selectedFieldId}
                        onChange={(e) => {
                            const newFieldId = e.target.value;
                            const newProperty = propertyFields.find((prop) => prop.id === newFieldId);
                            setSelectedFieldId(newFieldId);

                            // Reset value based on field type
                            if (newProperty?.type === 'select' || newProperty?.type === 'multiselect') {
                                setConditionValue([]);
                            } else {
                                setConditionValue('');
                            }
                        }}
                    >
                        <option value=''>
                            {formatMessage({defaultMessage: 'Select a field...'})}
                        </option>
                        {availableFields.map((property) => (
                            <option
                                key={property.id}
                                value={property.id}
                            >
                                {property.name}
                            </option>
                        ))}
                    </Select>
                </FormRow>

                {selectedFieldId && (
                    <>
                        <FormRow>
                            <FormLabel>
                                <FormattedMessage defaultMessage='Operator:'/>
                            </FormLabel>
                            <Select
                                value={selectedOperator}
                                onChange={(e) => setSelectedOperator(e.target.value as 'is' | 'isNot')}
                            >
                                <option value='is'>
                                    {formatMessage({defaultMessage: 'is'})}
                                </option>
                                <option value='isNot'>
                                    {formatMessage({defaultMessage: 'is not'})}
                                </option>
                            </Select>
                        </FormRow>

                        <FormRow>
                            <FormLabel>
                                <FormattedMessage defaultMessage='Value:'/>
                            </FormLabel>
                            {isSelectField ? (
                                <Select
                                    value={Array.isArray(conditionValue) ? (conditionValue[0] || '') : ''}
                                    onChange={(e) => {
                                        setConditionValue([e.target.value]);
                                    }}
                                >
                                    <option value=''>
                                        {formatMessage({defaultMessage: 'Select value...'})}
                                    </option>
                                    {selectedProperty?.attrs.options?.map((option) => (
                                        <option
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.name}
                                        </option>
                                    ))}
                                </Select>
                            ) : (
                                <TextInput
                                    value={conditionValue as string}
                                    onChange={(e) => setConditionValue(e.target.value)}
                                    placeholder={formatMessage({defaultMessage: 'Enter value...'})}
                                />
                            )}
                        </FormRow>
                    </>
                )}
            </EditorBody>
            <EditorFooter>
                <CancelButton onClick={onCancel}>
                    <FormattedMessage defaultMessage='Cancel'/>
                </CancelButton>
                <SaveButton
                    onClick={handleSave}
                    disabled={!selectedFieldId || !hasValidValue()}
                >
                    <FormattedMessage defaultMessage='Save'/>
                </SaveButton>
            </EditorFooter>
        </EditorContainer>
    );
};

const EditorContainer = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 320px;
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
`;

const EditorHeader = styled.div`
    padding: 12px 16px;
    font-weight: 600;
    font-size: 14px;
    color: var(--center-channel-color);
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const EditorBody = styled.div`
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const FormRow = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const FormLabel = styled.label`
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const Select = styled.select`
    width: 100%;
    padding: 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 13px;

    &:focus {
        outline: none;
        border-color: var(--button-bg);
    }
`;

const TextInput = styled.input`
    width: 100%;
    padding: 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 13px;

    &:focus {
        outline: none;
        border-color: var(--button-bg);
    }
`;

const EditorFooter = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const Button = styled.button`
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const CancelButton = styled(Button)`
    background: transparent;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    color: rgba(var(--center-channel-color-rgb), 0.72);

    &:hover:not(:disabled) {
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const SaveButton = styled(Button)`
    background: var(--button-bg);
    border: none;
    color: var(--button-color);

    &:hover:not(:disabled) {
        background: rgba(var(--button-bg-rgb), 0.92);
    }
`;

export default InlineConditionEditor;
