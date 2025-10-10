// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {
    Draggable,
    DraggableProvided,
    DraggableStateSnapshot,
    Droppable,
    DroppableProvided,
} from 'react-beautiful-dnd';
import ReactSelect, {StylesConfig} from 'react-select';

import {Condition, ConditionExprV1} from 'src/types/conditions';
import {ChecklistItem} from 'src/types/playbook';
import {PropertyField} from 'src/types/properties';
import Tooltip from 'src/components/widgets/tooltip';

interface ConditionalGroupProps {
    condition: Condition;
    items: ChecklistItem[];
    checklistIndex: number;
    itemIndex: number; // Index in the flat list for dragging
    propertyFields: PropertyField[];
    onDeleteCondition?: (conditionId: string) => void;
    onUpdateCondition?: (conditionId: string, expr: ConditionExprV1) => void;
    dragDisabled?: boolean;
    children: React.ReactNode;
}

type SelectOption = {
    value: string;
    label: string;
};

const ConditionalGroup = ({
    condition,
    items,
    checklistIndex,
    itemIndex,
    propertyFields,
    onDeleteCondition,
    onUpdateCondition,
    dragDisabled,
    children,
}: ConditionalGroupProps) => {
    const {formatMessage} = useIntl();

    // Helper to extract conditions from expr (handles both simple and compound conditions)
    const extractConditions = (expr: ConditionExprV1): Array<{operator: 'is' | 'isNot'; fieldId: string; value: string | string[]}> => {
        const conditions: Array<{operator: 'is' | 'isNot'; fieldId: string; value: string | string[]}> = [];

        // Check if it's a compound condition (and/or)
        const nestedExprs = expr.and || expr.or || [];
        if (nestedExprs.length > 0) {
            nestedExprs.forEach((nested) => {
                if (nested.is) {
                    conditions.push({operator: 'is', fieldId: nested.is.field_id, value: nested.is.value});
                } else if (nested.isNot) {
                    conditions.push({operator: 'isNot', fieldId: nested.isNot.field_id, value: nested.isNot.value});
                }
            });
        } else if (expr.is) {
            // Simple condition
            conditions.push({operator: 'is', fieldId: expr.is.field_id, value: expr.is.value});
        } else if (expr.isNot) {
            // Simple condition
            conditions.push({operator: 'isNot', fieldId: expr.isNot.field_id, value: expr.isNot.value});
        }

        return conditions;
    };

    const expr = condition.condition_expr;
    const initialConditions = extractConditions(expr);
    const initialLogicalOp: 'and' | 'or' = expr.and ? 'and' : 'or';

    // State for managing multiple conditions
    const [conditions, setConditions] = useState(initialConditions);
    const [logicalOperator, setLogicalOperator] = useState<'and' | 'or'>(initialLogicalOp);

    // Get available property fields (text, select, multiselect)
    const availableFields = propertyFields.filter(
        (field) => field.type === 'text' || field.type === 'select' || field.type === 'multiselect'
    );

    // Create options for ReactSelect
    const fieldOptions: SelectOption[] = availableFields.map((field) => ({
        value: field.id,
        label: field.name,
    }));

    const operatorOptions: SelectOption[] = [
        {value: 'is', label: formatMessage({defaultMessage: 'is'})},
        {value: 'isNot', label: formatMessage({defaultMessage: 'is not'})},
    ];

    const logicalOperatorOptions: SelectOption[] = [
        {value: 'and', label: formatMessage({defaultMessage: 'AND'})},
        {value: 'or', label: formatMessage({defaultMessage: 'OR'})},
    ];

    // Build the condition expression from current state
    const buildConditionExpr = (): ConditionExprV1 => {
        if (conditions.length === 1) {
            // Single condition - use simple format
            const cond = conditions[0];
            return {
                [cond.operator]: {
                    field_id: cond.fieldId,
                    value: cond.value,
                },
            };
        }

        // Multiple conditions - use logical operator
        const nestedExprs: ConditionExprV1[] = conditions.map((cond) => ({
            [cond.operator]: {
                field_id: cond.fieldId,
                value: cond.value,
            },
        }));

        return {
            [logicalOperator]: nestedExprs,
        };
    };

    // Handle updates
    const handleUpdate = () => {
        if (!onUpdateCondition) {
            return;
        }

        // Validate all conditions
        const allValid = conditions.every((cond) => cond.fieldId && cond.value);
        if (!allValid) {
            return;
        }

        const newExpr = buildConditionExpr();
        onUpdateCondition(condition.id, newExpr);
    };

    // Update a specific condition
    const updateCondition = (index: number, updates: Partial<typeof conditions[0]>) => {
        const newConditions = [...conditions];
        newConditions[index] = {...newConditions[index], ...updates};
        setConditions(newConditions);
        setTimeout(handleUpdate, 0);
    };

    // Add a new condition at a specific index (max 2 conditions)
    const addCondition = (afterIndex: number) => {
        // Limit to 2 conditions
        if (conditions.length >= 2) {
            return;
        }

        const firstField = availableFields[0];
        if (!firstField) {
            return;
        }

        let defaultValue: string | string[] = '';
        if (firstField.type === 'select' || firstField.type === 'multiselect') {
            defaultValue = firstField.attrs.options?.[0]?.id ? [firstField.attrs.options[0].id] : [];
        }

        const newCondition = {
            operator: 'is' as const,
            fieldId: firstField.id,
            value: defaultValue,
        };

        const newConditions = [...conditions];
        newConditions.splice(afterIndex + 1, 0, newCondition);
        setConditions(newConditions);
        setTimeout(handleUpdate, 0);
    };

    // Remove a condition
    const removeCondition = (index: number) => {
        if (conditions.length === 1) {
            // Don't allow removing the last condition
            return;
        }

        const newConditions = conditions.filter((_, i) => i !== index);
        setConditions(newConditions);
        setTimeout(handleUpdate, 0);
    };

    // Change logical operator
    const handleLogicalOperatorChange = (option: SelectOption | null | undefined) => {
        if (!option) {
            return;
        }
        setLogicalOperator(option.value as 'and' | 'or');
        setTimeout(handleUpdate, 0);
    };

    const draggableId = `condition-group-${condition.id}`;

    const renderConditionRow = (cond: typeof conditions[0], index: number) => {
        const selectedProperty = propertyFields.find((prop) => prop.id === cond.fieldId);
        const isSelectField = selectedProperty?.type === 'select' || selectedProperty?.type === 'multiselect';

        const valueOptions: SelectOption[] = isSelectField ? (selectedProperty?.attrs.options?.map((option) => ({
            value: option.id,
            label: option.name,
        })) || []) : [];

        const selectedFieldOption = fieldOptions.find((opt) => opt.value === cond.fieldId);
        const selectedOperatorOption = operatorOptions.find((opt) => opt.value === cond.operator);
        const selectedValueOption = isSelectField && Array.isArray(cond.value) ? valueOptions.find((opt) => opt.value === cond.value[0]) : undefined;

        return (
            <ConditionRow key={index}>
                <StyledReactSelect
                    value={selectedFieldOption}
                    options={fieldOptions}
                    onChange={(option: SelectOption | null) => {
                        if (!option) {
                            return;
                        }
                        const newProperty = propertyFields.find((prop) => prop.id === option.value);
                        let defaultValue: string | string[] = '';
                        if (newProperty?.type === 'select' || newProperty?.type === 'multiselect') {
                            defaultValue = newProperty.attrs.options?.[0]?.id ? [newProperty.attrs.options[0].id] : [];
                        }
                        updateCondition(index, {fieldId: option.value, value: defaultValue});
                    }}
                    placeholder={formatMessage({defaultMessage: 'Choose a property'})}
                    isSearchable={false}
                    styles={selectStyles}
                    classNamePrefix='condition-select'
                    menuPortalTarget={document.body}
                    menuPosition='fixed'
                />
                <StyledReactSelect
                    value={selectedOperatorOption}
                    options={operatorOptions}
                    onChange={(option: SelectOption | null) => {
                        if (option) {
                            updateCondition(index, {operator: option.value as 'is' | 'isNot'});
                        }
                    }}
                    isSearchable={false}
                    styles={selectStyles}
                    classNamePrefix='condition-select'
                    menuPortalTarget={document.body}
                    menuPosition='fixed'
                />
                {isSelectField ? (
                    <StyledReactSelect
                        value={selectedValueOption}
                        options={valueOptions}
                        onChange={(option: SelectOption | null) => {
                            if (option) {
                                updateCondition(index, {value: [option.value]});
                            }
                        }}
                        placeholder={formatMessage({defaultMessage: 'Choose a value'})}
                        isSearchable={false}
                        styles={selectStyles}
                        classNamePrefix='condition-select'
                        menuPortalTarget={document.body}
                        menuPosition='fixed'
                    />
                ) : (
                    <StyledInput
                        value={cond.value as string}
                        onChange={(e) => updateCondition(index, {value: e.target.value})}
                        onBlur={handleUpdate}
                        placeholder={formatMessage({defaultMessage: 'Enter value...'})}
                    />
                )}
                {index > 0 && index < conditions.length - 1 && (
                    <LogicalOperatorLabel>
                        {logicalOperator.toUpperCase()}
                    </LogicalOperatorLabel>
                )}
                {index === 0 && conditions.length > 1 && (
                    <LogicalOperatorSelect
                        value={logicalOperatorOptions.find((opt) => opt.value === logicalOperator)}
                        options={logicalOperatorOptions}
                        onChange={handleLogicalOperatorChange}
                        isSearchable={false}
                        styles={logicalOperatorSelectStyles}
                        classNamePrefix='condition-select'
                        menuPortalTarget={document.body}
                        menuPosition='fixed'
                    />
                )}
                {conditions.length < 2 && (
                    <Tooltip
                        id={`add-condition-tooltip-${condition.id}-${index}`}
                        content={formatMessage({defaultMessage: 'Add condition'})}
                    >
                        <span>
                            <AddConditionButton
                                onClick={() => addCondition(index)}
                            >
                                <i className='icon-plus'/>
                            </AddConditionButton>
                        </span>
                    </Tooltip>
                )}
                {conditions.length > 1 && (
                    <Tooltip
                        id={`remove-condition-tooltip-${condition.id}-${index}`}
                        content={formatMessage({defaultMessage: 'Remove condition'})}
                    >
                        <span>
                            <RemoveConditionButton
                                onClick={() => removeCondition(index)}
                            >
                                <i className='icon-close'/>
                            </RemoveConditionButton>
                        </span>
                    </Tooltip>
                )}
            </ConditionRow>
        );
    };

    return (
        <Draggable
            draggableId={draggableId}
            index={itemIndex}
            isDragDisabled={dragDisabled}
        >
            {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                <ConditionalContainer
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    $isDragging={snapshot.isDragging}
                >
                    <ConditionalHeader>
                        <DragHandle {...draggableProvided.dragHandleProps}>
                            <i className='icon-drag-vertical'/>
                        </DragHandle>
                        <IfLabel>{formatMessage({defaultMessage: 'If'})}</IfLabel>
                        <ConditionsWrapper>
                            {conditions.map((cond, index) => renderConditionRow(cond, index))}
                        </ConditionsWrapper>
                        {onDeleteCondition && (
                            <Tooltip
                                id={`delete-condition-group-${condition.id}`}
                                content={formatMessage({defaultMessage: 'Delete condition group'})}
                            >
                                <span>
                                    <DeleteButton
                                        onClick={() => onDeleteCondition(condition.id)}
                                    >
                                        <i className='icon-trash-can-outline'/>
                                    </DeleteButton>
                                </span>
                            </Tooltip>
                        )}
                    </ConditionalHeader>
                    <Droppable
                        droppableId={`condition-${condition.id}-checklist-${checklistIndex}`}
                        direction='vertical'
                        type='checklist-item'
                    >
                        {(droppableProvided: DroppableProvided, droppableSnapshot) => (
                            <ConditionalBody
                                ref={droppableProvided.innerRef}
                                {...droppableProvided.droppableProps}
                                $isDraggingOver={droppableSnapshot.isDraggingOver}
                            >
                                {children}
                                {droppableProvided.placeholder}
                                {items.length === 0 && (
                                    <EmptyDropZone $isDraggingOver={droppableSnapshot.isDraggingOver}>
                                        {formatMessage({defaultMessage: 'Drag tasks here'})}
                                    </EmptyDropZone>
                                )}
                            </ConditionalBody>
                        )}
                    </Droppable>
                    <ConditionIdDebug>ID: {condition.id}</ConditionIdDebug>
                </ConditionalContainer>
            )}
        </Draggable>
    );
};

const ConditionalContainer = styled.div<{$isDragging?: boolean}>`
    margin: 8px 0 12px 0;
    border-radius: 4px;
`;

const DragHandle = styled.div`
    display: flex;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
    cursor: grab;
    position: absolute;
    left: -25px;

    i {
        font-size: 16px;
    }

    &:hover {
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    &:active {
        cursor: grabbing;
    }
`;

const AddConditionButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease;
    flex-shrink: 0;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    i {
        font-size: 12px;
    }
`;

const RemoveConditionButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease;
    flex-shrink: 0;

    &:hover {
        background: rgba(var(--error-text-color-rgb), 0.08);
        color: var(--error-text);
    }

    i {
        font-size: 12px;
    }
`;

const ConditionalHeader = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 12px;
    position: relative;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.04);

        /* Show header-level buttons */
        > button,
        > span > button {
            opacity: 1;
        }

        ${DragHandle} {
            opacity: 1;
        }

        /* Show condition row buttons */
        ${AddConditionButton},
        ${RemoveConditionButton} {
            opacity: 1;
        }
    }
`;

const ConditionsWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
`;

const ConditionRow = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
`;

const LogicalOperatorSelect = styled(ReactSelect<SelectOption>)`
    min-width: 60px;
`;

const LogicalOperatorLabel = styled.span`
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    padding: 0 8px;
    height: 24px;
    display: flex;
    align-items: center;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 12px;
    flex-shrink: 0;
    min-width: 45px;
    justify-content: center;
`;

const IfLabel = styled.span`
    font-size: 13px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    height: 24px;
`;

const StyledReactSelect = styled(ReactSelect<SelectOption>)`
    // flex: 1;
    min-width: 120px;
`;

const StyledInput = styled.input`
    padding: 4px 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 13px;
    height: 24px;
    // flex: 1;

    &:focus {
        outline: none;
        border-color: var(--button-bg);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
`;

const selectStyles: StylesConfig<SelectOption, false> = {
    control: (provided, state) => ({
        ...provided,
        minHeight: '24px',
        height: '24px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
        boxShadow: 'none',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
        },
    }),
    valueContainer: (provided) => ({
        ...provided,
        height: '24px',
        padding: '0 8px',
    }),
    input: (provided) => ({
        ...provided,
        margin: '0',
        padding: '0',
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
    indicatorsContainer: (provided) => ({
        ...provided,
        height: '24px',
    }),
    dropdownIndicator: (provided) => ({
        ...provided,
        padding: '4px',
        color: 'rgba(var(--center-channel-color-rgb), 0.56)',
        '&:hover': {
            color: 'rgba(var(--center-channel-color-rgb), 0.72)',
        },
    }),
    menu: (provided) => ({
        ...provided,
        marginTop: '4px',
        borderRadius: '4px',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        backgroundColor: 'var(--center-channel-bg)',
        zIndex: 9999,
    }),
    menuPortal: (provided) => ({
        ...provided,
        zIndex: 9999,
    }),
    menuList: (provided) => ({
        ...provided,
        padding: '4px 0',
    }),
    option: (provided, state) => ({
        ...provided,
        fontSize: '13px',
        padding: '8px 12px',
        backgroundColor: (() => {
            switch (true) {
            case state.isSelected:
                return 'rgba(var(--button-bg-rgb), 0.08)';
            case state.isFocused:
                return 'rgba(var(--center-channel-color-rgb), 0.08)';
            default:
                return 'transparent';
            }
        })(),
        color: 'var(--center-channel-color)',
        cursor: 'pointer',
        '&:active': {
            backgroundColor: 'rgba(var(--button-bg-rgb), 0.08)',
        },
    }),
    placeholder: (provided) => ({
        ...provided,
        color: 'rgba(var(--center-channel-color-rgb), 0.64)',
        fontSize: '12px',
        fontWeight: 600,
    }),
    singleValue: (provided) => ({
        ...provided,
        color: 'var(--center-channel-color)',
        fontSize: '12px',
        fontWeight: 600,
    }),
};

const logicalOperatorSelectStyles: StylesConfig<SelectOption, false> = {
    ...selectStyles,
    control: (provided) => ({
        ...provided,
        minHeight: '24px',
        height: '24px',
        border: 'none',
        borderRadius: '12px',
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
        boxShadow: 'none',
        fontSize: '11px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.16)',
        },
    }),
    valueContainer: (provided) => ({
        ...provided,
        height: '24px',
        padding: '0 8px',
    }),
    indicatorsContainer: (provided) => ({
        ...provided,
        height: '24px',
    }),
    dropdownIndicator: (provided) => ({
        ...provided,
        padding: '2px',
        color: 'rgba(var(--center-channel-color-rgb), 0.72)',
        '&:hover': {
            color: 'rgba(var(--center-channel-color-rgb), 0.88)',
        },
    }),
    singleValue: (provided) => ({
        ...provided,
        color: 'var(--center-channel-color)',
        fontSize: '11px',
        fontWeight: 700,
    }),
};

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
    flex-shrink: 0;
    margin-top: 2px;

    &:hover {
        background: rgba(var(--error-text-color-rgb), 0.08);
        color: var(--error-text);
    }

    i {
        font-size: 14px;
    }
`;

const ConditionalBody = styled.div<{$isDraggingOver?: boolean}>`
    padding-left: 2px;
    min-height: 44px;
    margin-left: 15px;
    border-left: 1px dashed rgba(var(--center-channel-color-rgb), 0.36);
    transition: background-color 0.2s ease, border-color 0.2s ease;

    ${({$isDraggingOver}) => $isDraggingOver && `
        background: rgba(var(--button-bg-rgb), 0.04);
        border-left: 2px dashed rgba(var(--button-bg-rgb), 0.48);
        border-radius: 4px;
        min-height: 80px;
    `}
`;

const EmptyDropZone = styled.div<{$isDraggingOver?: boolean}>`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    margin: 4px 8px;
    border: 1px dashed rgba(var(--center-channel-color-rgb), ${({$isDraggingOver}) => ($isDraggingOver ? '0.48' : '0.24')});
    border-radius: 4px;
    background: ${({$isDraggingOver}) => ($isDraggingOver ? 'rgba(var(--button-bg-rgb), 0.04)' : 'transparent')};
    color: rgba(var(--center-channel-color-rgb), 0.48);
    font-size: 13px;
    font-style: italic;
`;

const ConditionIdDebug = styled.div`
    padding: 4px 12px;
    font-size: 10px;
    color: rgba(var(--center-channel-color-rgb), 0.48);
    font-family: monospace;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

export default ConditionalGroup;
