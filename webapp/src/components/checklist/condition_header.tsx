// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import ReactSelect, {StylesConfig} from 'react-select';
import {GlobalState} from '@mattermost/types/store';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {ConditionActionDef, ConditionExprV1} from 'src/types/conditions';
import {PropertyField} from 'src/types/properties';
import Tooltip from 'src/components/widgets/tooltip';
import {getCondition} from 'src/selectors';
import {useProxyState} from 'src/hooks';
import {useConfirmModal} from 'src/components/widgets/confirmation_modal';
import {extractConditions, formatCondition} from 'src/utils/condition_format';
import ProfileSelector from 'src/components/profile/profile_selector';
import ChannelSelector from 'src/components/backstage/channel_selector';
import {useProfilesInTeam} from 'src/hooks/general';

interface ConditionHeaderProps {
    conditionId: string;
    propertyFields: PropertyField[];
    onUpdate?: (expr: ConditionExprV1) => void;
    onUpdateActions?: (actions: ConditionActionDef[]) => void;
    onDelete?: () => void;
    checklistIndex: number;
    startEditing?: boolean;
    actions?: ConditionActionDef[];
}

type SelectOption = {
    value: string;
    label: string;
};

const ConditionHeader = ({
    conditionId,
    propertyFields,
    onUpdate,
    onUpdateActions,
    onDelete,
    startEditing = false,
    actions: propActions = [],
}: ConditionHeaderProps) => {
    const {formatMessage} = useIntl();
    const currentTeamId = useSelector(getCurrentTeamId);
    const profilesInTeam = useProfilesInTeam();

    // Get condition from Redux store
    const condition = useSelector((state: GlobalState) => getCondition(state, conditionId));

    // State for managing editing mode
    const [isEditing, setIsEditing] = useState(startEditing);

    // Hook for confirmation modal
    const openConfirmModal = useConfirmModal();

    // Use useProxyState to sync the entire condition expression with Redux
    const [conditionExpr, setConditionExpr] = useProxyState(
        condition?.condition_expr,
        useCallback((newExpr: ConditionExprV1) => {
            if (onUpdate) {
                onUpdate(newExpr);
            }
        }, [onUpdate])
    );

    // If condition not found, don't render
    if (!condition || !conditionExpr) {
        return null;
    }

    // Derive UI state from condition expression
    const conditions = extractConditions(conditionExpr);
    const logicalOperator: 'and' | 'or' = conditionExpr.and ? 'and' : 'or';

    // Get available property fields (text, select, multiselect)
    const availableFields = propertyFields.filter(
        (field) => field.type === 'text' || field.type === 'select' || field.type === 'multiselect'
    );

    // Create options for ReactSelect
    const fieldOptions: SelectOption[] = availableFields.map((field) => ({
        value: field.id,
        label: field.name,
    }));

    // Helper to get operator options based on field type
    const getOperatorOptions = (fieldId: string): SelectOption[] => {
        const field = propertyFields.find((f) => f.id === fieldId);
        if (field?.type === 'multiselect') {
            return [
                {value: 'is', label: formatMessage({defaultMessage: 'contains'})},
                {value: 'isNot', label: formatMessage({defaultMessage: 'does not contain'})},
            ];
        }
        return [
            {value: 'is', label: formatMessage({defaultMessage: 'is'})},
            {value: 'isNot', label: formatMessage({defaultMessage: 'is not'})},
        ];
    };

    const logicalOperatorOptions: SelectOption[] = [
        {value: 'and', label: formatMessage({defaultMessage: 'AND'})},
        {value: 'or', label: formatMessage({defaultMessage: 'OR'})},
    ];

    // Build the condition expression from current state
    const buildConditionExpr = (updatedConditions: typeof conditions, updatedLogicalOp: 'and' | 'or'): ConditionExprV1 => {
        if (updatedConditions.length === 1) {
            // Single condition - use simple format
            const cond = updatedConditions[0];
            return {
                [cond.operator]: {
                    field_id: cond.fieldId,
                    value: cond.value,
                },
            };
        }

        // Multiple conditions - use logical operator
        const nestedExprs: ConditionExprV1[] = updatedConditions.map((cond) => ({
            [cond.operator]: {
                field_id: cond.fieldId,
                value: cond.value,
            },
        }));

        return {
            [updatedLogicalOp]: nestedExprs,
        };
    };

    // Update a specific condition
    const updateCondition = (index: number, updates: Partial<typeof conditions[0]>) => {
        const newConditions = [...conditions];
        newConditions[index] = {...newConditions[index], ...updates};

        // Validate all conditions
        // For select/multiselect fields, value must be a non-empty array
        // For text fields, value can be an empty string (will be validated on save)
        const allValid = newConditions.every((cond) => {
            if (!cond.fieldId) {
                return false;
            }
            const field = propertyFields.find((f) => f.id === cond.fieldId);
            if (field?.type === 'text') {
                // Text fields can have empty values temporarily
                return cond.value !== undefined && cond.value !== null;
            }

            // Select/multiselect must have a non-empty array
            return Array.isArray(cond.value) && cond.value.length > 0;
        });
        if (!allValid) {
            return;
        }

        const newExpr = buildConditionExpr(newConditions, logicalOperator);
        setConditionExpr(newExpr);
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

        const newExpr = buildConditionExpr(newConditions, logicalOperator);
        setConditionExpr(newExpr);
    };

    // Remove a condition
    const removeCondition = (index: number) => {
        if (conditions.length === 1) {
            // Don't allow removing the last condition
            return;
        }

        const newConditions = conditions.filter((_, i) => i !== index);

        const newExpr = buildConditionExpr(newConditions, logicalOperator);
        setConditionExpr(newExpr);
    };

    // Change logical operator
    const handleLogicalOperatorChange = (option: SelectOption | null | undefined) => {
        if (!option) {
            return;
        }

        const newLogicalOp = option.value as 'and' | 'or';
        const newExpr = buildConditionExpr(conditions, newLogicalOp);
        setConditionExpr(newExpr);
    };

    // Render delete button (used in both edit and read-only modes)
    const renderDeleteButton = () => {
        if (!onDelete) {
            return null;
        }

        return (
            <Tooltip
                id={`remove-condition-${condition.id}`}
                content={formatMessage({defaultMessage: 'Remove condition'})}
            >
                <span>
                    <DestructiveActionButton
                        aria-label={formatMessage({defaultMessage: 'Delete condition'})}
                        data-testid='condition-header-delete-button'
                        onClick={() => {
                            openConfirmModal({
                                title: formatMessage({defaultMessage: 'Remove condition?'}),
                                message: formatMessage({defaultMessage: 'The condition will be removed from all tasks in this group. Tasks will not be deleted.'}),
                                confirmButtonText: formatMessage({defaultMessage: 'Remove'}),
                                isDestructive: true,
                                onConfirm: () => {
                                    if (onDelete) {
                                        onDelete();
                                    }
                                },
                            });
                        }}
                    >
                        <i className='icon-trash-can-outline'/>
                    </DestructiveActionButton>
                </span>
            </Tooltip>
        );
    };

    const renderConditionRow = (cond: typeof conditions[0], index: number) => {
        const selectedProperty = propertyFields.find((prop) => prop.id === cond.fieldId);
        const isSelectField = selectedProperty?.type === 'select';
        const isMultiSelectField = selectedProperty?.type === 'multiselect';

        const valueOptions: SelectOption[] = (isSelectField || isMultiSelectField) ? (selectedProperty?.attrs.options?.map((option) => ({
            value: option.id,
            label: option.name,
        })) || []) : [];

        const selectedFieldOption = fieldOptions.find((opt) => opt.value === cond.fieldId);
        const operatorOptions = getOperatorOptions(cond.fieldId);
        const selectedOperatorOption = operatorOptions.find((opt) => opt.value === cond.operator);

        // For select fields, get single value; for multiselect, get multiple values
        const selectedValueOptions = (isSelectField || isMultiSelectField) && Array.isArray(cond.value) ? valueOptions.filter((opt) => cond.value.includes(opt.value)) : undefined;

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
                {(isSelectField || isMultiSelectField) ? (
                    <StyledReactSelect
                        isMulti={isMultiSelectField}
                        value={isMultiSelectField ? selectedValueOptions : selectedValueOptions?.[0]}
                        options={valueOptions}
                        onChange={(optionOrOptions: SelectOption | readonly SelectOption[] | null) => {
                            if (isMultiSelectField && Array.isArray(optionOrOptions)) {
                                const values = optionOrOptions.map((opt) => opt.value);
                                updateCondition(index, {value: values});
                            } else if (!isMultiSelectField && optionOrOptions && !Array.isArray(optionOrOptions)) {
                                const singleOption = optionOrOptions as SelectOption;
                                updateCondition(index, {value: [singleOption.value]});
                            }
                        }}
                        placeholder={isMultiSelectField ? formatMessage({defaultMessage: 'Choose values'}) : formatMessage({defaultMessage: 'Choose a value'})}
                        isSearchable={false}
                        isClearable={false}
                        styles={selectStyles}
                        classNamePrefix='condition-select'
                        menuPortalTarget={document.body}
                        menuPosition='fixed'
                        closeMenuOnSelect={!isMultiSelectField}
                    />
                ) : (
                    <StyledInput
                        value={cond.value as string}
                        onChange={(e) => updateCondition(index, {value: e.target.value})}
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
                                data-testid='condition-add-button'
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
                                data-testid='condition-remove-button'
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

    const updateAction = (index: number, updates: Partial<ConditionActionDef>) => {
        const newActions = [...propActions];
        newActions[index] = {...newActions[index], ...updates};
        onUpdateActions?.(newActions);
    };

    const addAction = () => {
        onUpdateActions?.([...propActions, {type: 'set_owner'}]);
    };

    const removeAction = (index: number) => {
        onUpdateActions?.(propActions.filter((_, i) => i !== index));
    };

    // Render edit mode with full controls
    if (isEditing) {
        return (
            <HeaderContainer data-testid='condition-header'>
                <IfLabel>{formatMessage({defaultMessage: 'If'})}</IfLabel>
                <ConditionsWrapper>
                    {conditions.map((cond, index) => renderConditionRow(cond, index))}
                </ConditionsWrapper>
                {onUpdateActions && (
                    <ActionsEditor>
                        <ThenLabel>{formatMessage({defaultMessage: 'Then'})}</ThenLabel>
                        {propActions.map((action, index) => (
                            <ActionRow key={action.type + '-' + index}>
                                <ActionTypeSelect
                                    value={action.type}
                                    onChange={(e) => updateAction(index, {
                                        type: e.target.value as ConditionActionDef['type'],
                                        set_owner_user_id: e.target.value === 'set_owner' ? action.set_owner_user_id : undefined,
                                        notify_channel_ids: e.target.value === 'notify_channel' ? action.notify_channel_ids : undefined,
                                        notify_message: e.target.value === 'notify_channel' ? action.notify_message : undefined,
                                    })}
                                >
                                    <option value='set_owner'>{formatMessage({defaultMessage: 'Set owner'})}</option>
                                    <option value='notify_channel'>{formatMessage({defaultMessage: 'Notify channel'})}</option>
                                </ActionTypeSelect>
                                {action.type === 'set_owner' && (
                                    <PickerWrapper>
                                        <ProfileSelector
                                            selectedUserId={action.set_owner_user_id}
                                            placeholder={formatMessage({defaultMessage: 'Select user'})}
                                            enableEdit={true}
                                            getAllUsers={async () => profilesInTeam}
                                            selfIsFirstOption={true}
                                            onSelectedChange={(user) => updateAction(index, {set_owner_user_id: user?.id || ''})}
                                        />
                                    </PickerWrapper>
                                )}
                                {action.type === 'notify_channel' && (
                                    <>
                                        <PickerWrapper>
                                            <ChannelSelector
                                                channelIds={action.notify_channel_ids || []}
                                                onChannelsSelected={(ids) => updateAction(index, {notify_channel_ids: ids})}
                                                isDisabled={false}
                                                captureMenuScroll={true}
                                                shouldRenderValue={true}
                                                teamId={currentTeamId}
                                                isMulti={true}
                                                placeholder={formatMessage({defaultMessage: 'Select channels'})}
                                            />
                                        </PickerWrapper>
                                        <ActionInput
                                            value={action.notify_message || ''}
                                            onChange={(e) => updateAction(index, {notify_message: e.target.value})}
                                            placeholder={formatMessage({defaultMessage: 'Message (use curly braces around field names)'})}
                                        />
                                    </>
                                )}
                                <RemoveConditionButton onClick={() => removeAction(index)}>
                                    <i className='icon-close'/>
                                </RemoveConditionButton>
                            </ActionRow>
                        ))}
                        <AddActionButton onClick={addAction}>
                            <i className='icon-plus'/>
                            <span>{formatMessage({defaultMessage: 'Add action'})}</span>
                        </AddActionButton>
                    </ActionsEditor>
                )}
                <Actions>
                    <Tooltip
                        id={`done-editing-${condition.id}`}
                        content={formatMessage({defaultMessage: 'Done editing'})}
                    >
                        <span>
                            <ActionButton
                                aria-label={formatMessage({defaultMessage: 'Save condition changes'})}
                                data-testid='condition-header-save-button'
                                onClick={() => setIsEditing(false)}
                            >
                                <i className='icon-check'/>
                            </ActionButton>
                        </span>
                    </Tooltip>
                    {renderDeleteButton()}
                </Actions>
            </HeaderContainer>
        );
    }

    // Render read-only view with compact formatting
    return (
        <ReadOnlyContainer data-testid='condition-header'>
            <PlainText>{formatMessage({defaultMessage: 'If'})}</PlainText>
            <ConditionsText>
                {conditions.map((cond, index) => {
                    const {fieldName, operator, valueNames} = formatCondition(
                        cond,
                        propertyFields,
                        formatMessage({defaultMessage: 'is'}),
                        formatMessage({defaultMessage: 'is not'})
                    );
                    return (
                        <React.Fragment key={index}>
                            {index > 0 && (
                                <PlainText>
                                    {logicalOperator}
                                </PlainText>
                            )}
                            <Chip>{fieldName}</Chip>
                            <PlainText>{operator}</PlainText>
                            {valueNames.map((valueName, valueIndex) => (
                                <Chip key={valueIndex}>{valueName}</Chip>
                            ))}
                        </React.Fragment>
                    );
                })}
            </ConditionsText>
            <Actions>
                {onUpdate && (
                    <Tooltip
                        id={`edit-condition-${condition.id}`}
                        content={formatMessage({defaultMessage: 'Edit condition'})}
                    >
                        <span>
                            <ActionButton
                                data-testid='condition-header-edit-button'
                                onClick={() => setIsEditing(true)}
                            >
                                <i className='icon-pencil-outline'/>
                            </ActionButton>
                        </span>
                    </Tooltip>
                )}
                {renderDeleteButton()}
            </Actions>
        </ReadOnlyContainer>
    );
};

const AddConditionButton = styled.button`
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
    margin: 0 0 4px;
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
    margin: 0 0 4px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
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
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const Chip = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    min-height: 24px;
    font-size: 12px;
    font-weight: 600;
    color: var(--center-channel-color);
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
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
    transition: background 0.15s ease, color 0.15s ease;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    i {
        font-size: 14px;
    }
`;

const DestructiveActionButton = styled(ActionButton)`
    &:hover {
        background: rgba(var(--error-text-color-rgb), 0.08);
        color: var(--error-text);
    }
`;

const ActionsEditor = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    width: 100%;
`;

const ThenLabel = styled.span`
    font-size: 13px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    flex-shrink: 0;
`;

const ActionRow = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
`;

const ActionTypeSelect = styled.select`
    height: 24px;
    padding: 0 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 12px;
`;

const ActionInput = styled.input`
    padding: 4px 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 12px;
    height: 24px;
    flex: 1;
    min-width: 120px;

    &:focus {
        outline: none;
        border-color: var(--button-bg);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
`;

const PickerWrapper = styled.div`
    min-width: 180px;
    max-width: 280px;
`;

const AddActionButton = styled.button`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: none;
    border-radius: 4px;
    background: none;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    cursor: pointer;
    align-self: flex-start;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    i {
        font-size: 12px;
    }
`;

export default ConditionHeader;
