// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import ReactSelect, {StylesConfig} from 'react-select';

import {Condition, ConditionExprV1} from 'src/types/conditions';
import {PropertyField} from 'src/types/properties';
import Tooltip from 'src/components/widgets/tooltip';

interface ConditionHeaderProps {
    condition: Condition;
    propertyFields: PropertyField[];
    onUpdate?: (expr: ConditionExprV1) => void;
    onDelete?: () => void;
    checklistIndex: number;
    startEditing?: boolean;
}

type SelectOption = {
    value: string;
    label: string;
};

const ConditionHeader = ({
    condition,
    propertyFields,
    onUpdate,
    onDelete,
    startEditing = false,
}: ConditionHeaderProps) => {
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

    // State for managing multiple conditions and editing mode
    const [isEditing, setIsEditing] = useState(startEditing);
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
        if (!onUpdate) {
            return;
        }

        // Validate all conditions
        const allValid = conditions.every((cond) => cond.fieldId && cond.value);
        if (!allValid) {
            return;
        }

        const newExpr = buildConditionExpr();
        onUpdate(newExpr);
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

    // Format a single condition for read-only display
    const formatCondition = (cond: typeof conditions[0]) => {
        const field = propertyFields.find((f) => f.id === cond.fieldId);
        const fieldName = field?.name || 'Unknown field';
        const operator = cond.operator === 'is' ? formatMessage({defaultMessage: 'is'}) : formatMessage({defaultMessage: 'is not'});

        let valueName = '';
        if (field && (field.type === 'select' || field.type === 'multiselect')) {
            const valueId = Array.isArray(cond.value) ? cond.value[0] : cond.value;
            const option = field.attrs.options?.find((opt) => opt.id === valueId);
            valueName = option?.name || valueId;
        } else {
            valueName = Array.isArray(cond.value) ? cond.value[0] || '' : cond.value;
        }

        return {fieldName, operator, valueName};
    };

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

    // Render edit mode with full controls
    if (isEditing) {
        return (
            <HeaderContainer>
                <IfLabel>{formatMessage({defaultMessage: 'If'})}</IfLabel>
                <ConditionsWrapper>
                    {conditions.map((cond, index) => renderConditionRow(cond, index))}
                </ConditionsWrapper>
                <Actions>
                    <Tooltip
                        id={`done-editing-${condition.id}`}
                        content={formatMessage({defaultMessage: 'Done editing'})}
                    >
                        <span>
                            <ActionButton onClick={() => setIsEditing(false)}>
                                <i className='icon-check'/>
                            </ActionButton>
                        </span>
                    </Tooltip>
                    {onDelete && (
                        <Tooltip
                            id={`delete-condition-${condition.id}`}
                            content={formatMessage({defaultMessage: 'Delete condition'})}
                        >
                            <span>
                                <ActionButton onClick={onDelete}>
                                    <i className='icon-trash-can-outline'/>
                                </ActionButton>
                            </span>
                        </Tooltip>
                    )}
                </Actions>
            </HeaderContainer>
        );
    }

    // Render read-only view with compact formatting
    return (
        <ReadOnlyContainer>
            <PlainText>{formatMessage({defaultMessage: 'If'})}</PlainText>
            <ConditionsText>
                {conditions.map((cond, index) => {
                    const {fieldName, operator, valueName} = formatCondition(cond);
                    return (
                        <React.Fragment key={index}>
                            {index > 0 && (
                                <PlainText>
                                    {logicalOperator}
                                </PlainText>
                            )}
                            <Chip>{fieldName}</Chip>
                            <PlainText>{operator}</PlainText>
                            <Chip>{valueName}</Chip>
                        </React.Fragment>
                    );
                })}
            </ConditionsText>
            <ConditionIdIndicator>
                {condition.id}
            </ConditionIdIndicator>
            <Actions>
                {onUpdate && (
                    <Tooltip
                        id={`edit-condition-${condition.id}`}
                        content={formatMessage({defaultMessage: 'Edit condition'})}
                    >
                        <span>
                            <ActionButton onClick={() => setIsEditing(true)}>
                                <i className='icon-pencil-outline'/>
                            </ActionButton>
                        </span>
                    </Tooltip>
                )}
                {onDelete && (
                    <Tooltip
                        id={`delete-condition-${condition.id}`}
                        content={formatMessage({defaultMessage: 'Delete condition'})}
                    >
                        <span>
                            <ActionButton onClick={onDelete}>
                                <i className='icon-trash-can-outline'/>
                            </ActionButton>
                        </span>
                    </Tooltip>
                )}
            </Actions>
        </ReadOnlyContainer>
    );
};

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

// Read-only container (compact view)
const ReadOnlyContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    margin: 0 0 4px 0;
    border-radius: 4px;
    font-size: 12px;
    transition: background 0.15s ease;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

// Edit mode container (full controls)
const HeaderContainer = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 12px;
    margin: 0 0 4px 0;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
    font-size: 12px;

    &:hover {
        ${AddConditionButton},
        ${RemoveConditionButton} {
            opacity: 1;
        }
    }
`;

const IfLabel = styled.span`
    font-size: 13px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    height: 24px;
`;

// Read-only view components
const ConditionsText = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    flex-wrap: wrap;
`;

const PlainText = styled.span`
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const Chip = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    min-height: 24px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    background: transparent;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
    border-radius: 4px;
`;

const ConditionIdIndicator = styled.span`
    font-size: 10px;
    color: rgba(var(--center-channel-color-rgb), 0.32);
    margin-left: 4px;
    font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', monospace;
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

const StyledReactSelect = styled(ReactSelect<SelectOption>)`
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

    &:focus {
        outline: none;
        border-color: var(--button-bg);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
`;

const selectStyles: StylesConfig<SelectOption, false> = {
    control: (provided) => ({
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
        backgroundColor: state.isSelected ? 'rgba(var(--button-bg-rgb), 0.08)' : state.isFocused ? 'rgba(var(--center-channel-color-rgb), 0.08)' : 'transparent',
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
        minWidth: '70px',
        transition: 'background-color 0.15s ease',
        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.16)',
        },
    }),
};

const Actions = styled.div`
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;

    ${HeaderContainer}:hover &,
    ${ReadOnlyContainer}:hover & {
        opacity: 1;
    }
`;

const ActionButton = styled.button`
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
    transition: background 0.15s ease;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    i {
        font-size: 14px;
    }
`;

export default ConditionHeader;
