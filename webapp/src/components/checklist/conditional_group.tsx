// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {Droppable, DroppableProvided} from 'react-beautiful-dnd';

import {Condition} from 'src/types/conditions';
import {ChecklistItem} from 'src/types/playbook';
import {PropertyField} from 'src/types/properties';

interface ConditionalGroupProps {
    condition: Condition;
    items: ChecklistItem[];
    checklistIndex: number;
    propertyFields: PropertyField[];
    onDeleteCondition?: (conditionId: string) => void;
    children: React.ReactNode;
}

const ConditionalGroup = ({
    condition,
    items,
    checklistIndex,
    propertyFields,
    onDeleteCondition,
    children,
}: ConditionalGroupProps) => {
    const {formatMessage} = useIntl();

    // Format condition for display
    const formatCondition = () => {
        const expr = condition.condition_expr;
        let operator = '';
        let fieldId = '';
        let value: string | string[] = '';

        if ('is' in expr && expr.is) {
            operator = formatMessage({defaultMessage: 'is'});
            fieldId = expr.is.field_id;
            value = expr.is.value;
        } else if ('isNot' in expr && expr.isNot) {
            operator = formatMessage({defaultMessage: 'is not'});
            fieldId = expr.isNot.field_id;
            value = expr.isNot.value;
        }

        const property = propertyFields.find((prop) => prop.id === fieldId);
        const fieldName = property?.name || fieldId;

        // Format value display
        let displayValue = '';
        if (property?.type === 'select' || property?.type === 'multiselect') {
            const valueArray = Array.isArray(value) ? value : [value];
            const optionNames = valueArray.map((optionId) => {
                const option = property.attrs.options?.find((opt) => opt.id === optionId);
                return option?.name || optionId;
            });
            displayValue = optionNames.join(', ');
        } else {
            displayValue = Array.isArray(value) ? value.join(', ') : String(value);
        }

        return {fieldName, operator, displayValue};
    };

    const {fieldName, operator, displayValue} = formatCondition();

    return (
        <ConditionalContainer>
            <ConditionalHeader>
                <ConditionalIcon className="icon-source-branch" />
                <ConditionalText>
                    <FieldName>{fieldName}</FieldName>
                    <Operator>{operator}</Operator>
                    <ConditionValue>{displayValue}</ConditionValue>
                </ConditionalText>
                {onDeleteCondition && (
                    <DeleteButton
                        onClick={() => onDeleteCondition(condition.id)}
                        title={formatMessage({defaultMessage: 'Delete condition'})}
                    >
                        <i className="icon-close" />
                    </DeleteButton>
                )}
            </ConditionalHeader>
            <Droppable
                droppableId={`condition-${condition.id}-checklist-${checklistIndex}`}
                direction="vertical"
                type="checklist-item"
            >
                {(droppableProvided: DroppableProvided) => (
                    <ConditionalBody
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                    >
                        {children}
                        {droppableProvided.placeholder}
                        {items.length === 0 && (
                            <EmptyDropZone>
                                {formatMessage({defaultMessage: 'Drag tasks here'})}
                            </EmptyDropZone>
                        )}
                    </ConditionalBody>
                )}
            </Droppable>
        </ConditionalContainer>
    );
};

const ConditionalContainer = styled.div`
    margin: 8px 0 12px 0;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.02);
    overflow: hidden;
`;

const ConditionalHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    position: relative;

    &:hover {
        button {
            opacity: 1;
        }
    }
`;

const ConditionalIcon = styled.i`
    font-size: 14px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const ConditionalText = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    flex: 1;
`;

const FieldName = styled.span`
    font-weight: 600;
    color: var(--center-channel-color);
`;

const Operator = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-style: italic;
`;

const ConditionValue = styled.span`
    font-weight: 600;
    color: var(--center-channel-color);
    padding: 2px 6px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 3px;
`;

const DeleteButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease;

    &:hover {
        background: rgba(var(--error-text-color-rgb), 0.08);
        color: var(--error-text);
    }

    i {
        font-size: 14px;
    }
`;

const ConditionalBody = styled.div`
    padding: 4px 0;
    min-height: 44px;
`;

const EmptyDropZone = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    margin: 4px 8px;
    border: 1px dashed rgba(var(--center-channel-color-rgb), 0.24);
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.48);
    font-size: 13px;
    font-style: italic;
`;

export default ConditionalGroup;
