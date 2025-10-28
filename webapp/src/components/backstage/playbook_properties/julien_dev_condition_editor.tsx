/* eslint-disable */
// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage} from 'react-intl';

import {usePlaybookConditions} from 'src/hooks';
import {Condition, ConditionExprV1} from 'src/types/conditions';
import {FullPlaybook, useUpdatePlaybook} from 'src/graphql/hooks';

interface Props {
    playbook: FullPlaybook;
}

const JulienDevConditionEditor = ({playbook}: Props) => {
    if (!playbook) {
        return <div>Loading playbook...</div>;
    }

    const playbookID = playbook.id;
    const checklists = playbook.checklists;
    const {conditions, refetch, createCondition} = usePlaybookConditions(playbookID);
    const updatePlaybook = useUpdatePlaybook(playbookID);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Condition builder state
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [selectedOperator, setSelectedOperator] = useState<'is' | 'isNot'>('is');
    const [conditionValue, setConditionValue] = useState<string | string[]>('');

    // Attach checklist items state
    const [attachingConditionId, setAttachingConditionId] = useState<string | null>(null);

    const resetForm = () => {
        setSelectedFieldId('');
        setSelectedOperator('is');
        setConditionValue('');
    };

    const findChecklistItemsUsingCondition = (conditionId: string) => {
        const matchingItems: Array<{
            checklistIndex: number;
            checklistTitle: string;
            itemIndex: number;
            item: any;
        }> = [];

        checklists.forEach((checklist, checklistIndex) => {
            checklist.items.forEach((item, itemIndex) => {
                if (item.condition_id === conditionId) {
                    matchingItems.push({
                        checklistIndex,
                        checklistTitle: checklist.title || `Checklist ${checklistIndex + 1}`,
                        itemIndex,
                        item,
                    });
                }
            });
        });

        return matchingItems;
    };

    const getAllChecklistItems = () => {
        const allItems: Array<{
            id: string;
            checklistIndex: number;
            checklistTitle: string;
            itemIndex: number;
            item: any;
        }> = [];

        checklists.forEach((checklist, checklistIndex) => {
            checklist.items.forEach((item, itemIndex) => {
                allItems.push({
                    id: `${checklistIndex}-${itemIndex}`,
                    checklistIndex,
                    checklistTitle: checklist.title || `Checklist ${checklistIndex + 1}`,
                    itemIndex,
                    item,
                });
            });
        });

        return allItems;
    };

    const handleAttachChecklistItems = (conditionId: string) => {
        setAttachingConditionId(conditionId);
    };

    const handleItemToggle = async (itemId: string) => {
        if (!attachingConditionId || !playbook) {
            return;
        }

        const [checklistIndex, itemIndex] = itemId.split('-').map(Number);
        const item = checklists[checklistIndex]?.items[itemIndex];
        if (!item) {
            return;
        }

        // Toggle the condition - if already attached to this condition, remove it, otherwise attach it
        const isCurrentlyAttached = item.condition_id === attachingConditionId;
        const newConditionId = isCurrentlyAttached ? '' : attachingConditionId;

        try {
            // Create updated checklists with the single item toggled
            const updatedChecklists = checklists.map((checklist, clIndex) => ({
                ...checklist,
                items: checklist.items.map((checklistItem, itIndex) => {
                    // Transform to GraphQL format
                    const baseItem = {
                        title: checklistItem.title,
                        description: checklistItem.description,
                        state: checklistItem.state,
                        stateModified: checklistItem.state_modified || 0,
                        assigneeID: checklistItem.assignee_id || '',
                        assigneeModified: checklistItem.assignee_modified || 0,
                        command: checklistItem.command,
                        commandLastRun: checklistItem.command_last_run,
                        dueDate: checklistItem.due_date,
                        taskActions: checklistItem.task_actions,
                    };

                    // Only update conditionID for the specific item we're toggling
                    const conditionID = (clIndex === checklistIndex && itIndex === itemIndex) ? newConditionId : checklistItem.condition_id;

                    return {
                        ...baseItem,
                        conditionID,
                    };
                }),
            }));

            // Update the playbook immediately
            await updatePlaybook({
                checklists: updatedChecklists,
            });

            // Refresh to update the UI
            refetch();
        } catch (error) {
            console.error('Failed to toggle checklist item attachment:', error);
        }
    };

    const handleCancelAttach = () => {
        setAttachingConditionId(null);
    };

    // Helper to check if the current value is valid
    const hasValidValue = () => {
        if (Array.isArray(conditionValue)) {
            return conditionValue.length > 0;
        }
        return Boolean(conditionValue);
    };

    const handleCreateCondition = async () => {
        try {
            if (!selectedFieldId) {
                console.error('Field is required');
                return;
            }

            if (!conditionValue || (Array.isArray(conditionValue) && conditionValue.length === 0)) {
                console.error('Value is required');
                return;
            }

            // Build the condition expression
            const conditionExpr: ConditionExprV1 = {
                [selectedOperator]: {
                    field_id: selectedFieldId,
                    value: conditionValue,
                },
            };

            await createCondition({
                version: 1,
                condition_expr: conditionExpr,
                playbook_id: playbookID,
            });

            resetForm();
            setShowCreateForm(false);
            refetch();
        } catch (error) {
            console.error('Failed to create condition:', error);
        }
    };

    const selectedProperty = playbook.propertyFields.find((prop) => prop.id === selectedFieldId);
    const isSelectField = selectedProperty?.type === 'select';
    const isMultiSelectField = selectedProperty?.type === 'multiselect';

    // Helper function to format condition for display
    const formatConditionDisplay = (condition: Condition) => {
        const expr = condition.condition_expr;

        // Get the operator and field info
        let operator = '';
        let fieldId = '';
        let value: string | string[] = '';

        if ('is' in expr && expr.is) {
            operator = 'is';
            fieldId = expr.is.field_id;
            value = expr.is.value;
        } else if ('isNot' in expr && expr.isNot) {
            operator = 'is not';
            fieldId = expr.isNot.field_id;
            value = expr.isNot.value;
        }

        // Find the property field
        const property = playbook.propertyFields.find((prop) => prop.id === fieldId);
        const fieldName = property?.name || fieldId;

        // Format the value based on field type
        let displayValue = '';
        if (property?.type === 'select' || property?.type === 'multiselect') {
            // Convert option IDs to option names
            const valueArray = Array.isArray(value) ? value : [value];
            const optionNames = valueArray.map((optionId) => {
                const option = property.attrs.options?.find((opt) => opt.id === optionId);
                return option?.name || optionId;
            });
            displayValue = optionNames.join(', ');
        } else {
            // Text field - display as-is
            displayValue = Array.isArray(value) ? value.join(', ') : String(value);
        }

        return {
            fieldName,
            operator,
            displayValue,
            property,
        };
    };

    return (
        <JulienDevOuterContainer>
            <JulienDevInnerContainer>
                <Container>
                    <Header>
                        <i className='icon-cog'/>
                        <FormattedMessage defaultMessage='Condition Editor (Dev)'/>
                        <RefreshButton onClick={refetch}>
                            <i className='icon-refresh'/>
                        </RefreshButton>
                    </Header>
                    <Content>
                        <div>
                            <FormattedMessage
                                defaultMessage='Development condition editor for playbook ID: {playbookID}'
                                values={{playbookID}}
                            />
                        </div>

                        <ConditionsSection>
                            <ConditionsSectionHeader>
                                <SubHeader>
                                    <FormattedMessage
                                        defaultMessage='Conditions ({count})'
                                        values={{count: conditions.length}}
                                    />
                                </SubHeader>
                                <CreateButton onClick={() => setShowCreateForm(!showCreateForm)}>
                                    <i className='icon-plus'/>
                                    <FormattedMessage defaultMessage='Create'/>
                                </CreateButton>
                            </ConditionsSectionHeader>

                            {showCreateForm && (
                                <CreateForm>
                                    <FormHeader>
                                        <FormattedMessage defaultMessage='Create New Condition'/>
                                    </FormHeader>

                                    <ConditionBuilder>
                                        <BuilderRow>
                                            <FormField>
                                                <FormLabel>
                                                    <FormattedMessage defaultMessage='Field:'/>
                                                </FormLabel>
                                                <Select
                                                    value={selectedFieldId}
                                                    onChange={(e) => {
                                                        const newFieldId = e.target.value;
                                                        const newProperty = playbook.propertyFields.find((prop) => prop.id === newFieldId);
                                                        setSelectedFieldId(newFieldId);

                                                        // Reset value appropriately based on field type
                                                        if (newProperty?.type === 'select' || newProperty?.type === 'multiselect') {
                                                            setConditionValue([]);
                                                        } else {
                                                            setConditionValue('');
                                                        }
                                                    }}
                                                >
                                                    <option value=''>
                                                        Select a field...
                                                    </option>
                                                    {playbook.propertyFields.map((property) => (
                                                        <option
                                                            key={property.id}
                                                            value={property.id}
                                                        >
                                                            {property.name} ({property.type})
                                                        </option>
                                                    ))}
                                                </Select>
                                            </FormField>

                                            <FormField>
                                                <FormLabel>
                                                    <FormattedMessage defaultMessage='Operator:'/>
                                                </FormLabel>
                                                <Select
                                                    value={selectedOperator}
                                                    onChange={(e) => setSelectedOperator(e.target.value as 'is' | 'isNot')}
                                                >
                                                    <option value='is'>
                                                        is
                                                    </option>
                                                    <option value='isNot'>
                                                        is not
                                                    </option>
                                                </Select>
                                            </FormField>
                                        </BuilderRow>

                                        {selectedFieldId && (
                                            <BuilderRow>
                                                <FormField>
                                                    <FormLabel>
                                                        <FormattedMessage defaultMessage='Value:'/>
                                                    </FormLabel>
                                                    {isSelectField || isMultiSelectField ? (
                                                        <Select
                                                            value={Array.isArray(conditionValue) ? (conditionValue[0] || '') : ''}
                                                            onChange={(e) => {
                                                                // For both select and multiselect, store as array
                                                                setConditionValue([e.target.value]);
                                                            }}
                                                        >
                                                            <option value=''>
                                                                Select value...
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
                                                            placeholder='Enter value...'
                                                        />
                                                    )}
                                                </FormField>
                                            </BuilderRow>
                                        )}
                                    </ConditionBuilder>

                                    <FormActions>
                                        <FormButton
                                            onClick={handleCreateCondition}
                                            disabled={!selectedFieldId || !hasValidValue()}
                                        >
                                            <FormattedMessage defaultMessage='Create Condition'/>
                                        </FormButton>
                                        <FormButton
                                            secondary={true}
                                            onClick={() => {
                                                setShowCreateForm(false);
                                                resetForm();
                                            }}
                                        >
                                            <FormattedMessage defaultMessage='Cancel'/>
                                        </FormButton>
                                    </FormActions>
                                </CreateForm>
                            )}
                            {conditions.length === 0 ? (
                                <EmptyMessage>
                                    <FormattedMessage defaultMessage='No conditions available'/>
                                </EmptyMessage>
                            ) : (
                                <ConditionsList>
                                    {conditions.map((condition) => (
                                        <ConditionItem key={condition.id}>
                                            <ConditionHeader>
                                                <ConditionName>Condition</ConditionName>
                                                <ConditionVersion>(v{condition.version})</ConditionVersion>
                                                <ConditionId>{condition.id}</ConditionId>
                                            </ConditionHeader>
                                            <ConditionDetails>
                                                <HumanReadableCondition>
                                                    {(() => {
                                                        const formatted = formatConditionDisplay(condition);
                                                        return (
                                                            <>
                                                                <FieldName>{formatted.fieldName}</FieldName>
                                                                <Operator>{formatted.operator}</Operator>
                                                                <ConditionValue>{formatted.displayValue}</ConditionValue>
                                                                {formatted.property && (
                                                                    <FieldType>({formatted.property.type})</FieldType>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </HumanReadableCondition>
                                                <ConditionJSON>
                                                    {JSON.stringify(condition.condition_expr, null, 2)}
                                                </ConditionJSON>
                                            </ConditionDetails>
                                            <ConditionUsageSection>
                                                <ConditionUsageHeaderWithButton>
                                                    <ConditionUsageHeader>
                                                        <FormattedMessage
                                                            defaultMessage='Used by Checklist Items ({count})'
                                                            values={{count: findChecklistItemsUsingCondition(condition.id).length}}
                                                        />
                                                    </ConditionUsageHeader>
                                                    <AttachButton onClick={() => handleAttachChecklistItems(condition.id)}>
                                                        <i className='icon-plus'/>
                                                        <FormattedMessage defaultMessage='Attach Checklist Item'/>
                                                    </AttachButton>
                                                </ConditionUsageHeaderWithButton>
                                                {findChecklistItemsUsingCondition(condition.id).length === 0 ? (
                                                    <ConditionUsageEmpty>
                                                        <FormattedMessage defaultMessage='No checklist items use this condition'/>
                                                    </ConditionUsageEmpty>
                                                ) : (
                                                    <ConditionUsageList>
                                                        {findChecklistItemsUsingCondition(condition.id).map((usage, index) => (
                                                            <ConditionUsageItem key={index}>
                                                                <ConditionUsageItemHeader>
                                                                    <ConditionUsageItemTitle>
                                                                        {usage.item.title}
                                                                    </ConditionUsageItemTitle>
                                                                    <ConditionUsageItemLocation>
                                                                        #{usage.checklistIndex + 1}.{usage.itemIndex + 1}
                                                                    </ConditionUsageItemLocation>
                                                                </ConditionUsageItemHeader>
                                                                <ConditionUsageItemDetails>
                                                                    <ConditionUsageDetail>
                                                                        <FormattedMessage
                                                                            defaultMessage='Checklist: {title}'
                                                                            values={{title: usage.checklistTitle}}
                                                                        />
                                                                    </ConditionUsageDetail>
                                                                    <ConditionUsageDetail>
                                                                        <FormattedMessage
                                                                            defaultMessage='Action: {action}'
                                                                            values={{action: usage.item.conditionAction || 'none'}}
                                                                        />
                                                                    </ConditionUsageDetail>
                                                                    <ConditionUsageDetail>
                                                                        <FormattedMessage
                                                                            defaultMessage='State: {state}'
                                                                            values={{state: usage.item.state}}
                                                                        />
                                                                    </ConditionUsageDetail>
                                                                </ConditionUsageItemDetails>
                                                            </ConditionUsageItem>
                                                        ))}
                                                    </ConditionUsageList>
                                                )}
                                            </ConditionUsageSection>
                                        </ConditionItem>
                                    ))}
                                </ConditionsList>
                            )}
                        </ConditionsSection>
                    </Content>
                </Container>
            </JulienDevInnerContainer>

            {/* Attach Checklist Items Modal */}
            {attachingConditionId && (
                <AttachModal onClick={handleCancelAttach}>
                    <AttachModalContent onClick={(e) => e.stopPropagation()}>
                        <AttachModalHeader>
                            <AttachModalTitle>
                                <FormattedMessage defaultMessage='Attach Checklist Items to Condition'/>
                            </AttachModalTitle>
                            <AttachModalCloseButton onClick={handleCancelAttach}>
                                <i className='icon-close'/>
                            </AttachModalCloseButton>
                        </AttachModalHeader>
                        <AttachModalBody>
                            <AttachModalDescription>
                                <FormattedMessage
                                    defaultMessage='Click any checklist item to toggle its attachment to condition {conditionId}. Items already attached to other conditions are disabled.'
                                    values={{conditionId: attachingConditionId}}
                                />
                            </AttachModalDescription>
                            <ChecklistItemSelector>
                                {getAllChecklistItems().map((item) => {
                                    const isSelected = item.item.condition_id === attachingConditionId;
                                    const isDisabled = item.item.condition_id && item.item.condition_id !== attachingConditionId;

                                    return (
                                        <ChecklistItemOption
                                            key={item.id}
                                            $selected={isSelected}
                                            $disabled={isDisabled}
                                            onClick={isDisabled ? undefined : () => handleItemToggle(item.id)}
                                        >
                                            <ChecklistItemOptionContent>
                                                <ChecklistItemOptionTitle>
                                                    {item.item.title}
                                                    {isDisabled && (
                                                        <DisabledBadge>
                                                            <FormattedMessage
                                                                defaultMessage='Attached to {conditionId}'
                                                                values={{conditionId: item.item.condition_id}}
                                                            />
                                                        </DisabledBadge>
                                                    )}
                                                </ChecklistItemOptionTitle>
                                                <ChecklistItemOptionMeta>
                                                    <FormattedMessage
                                                        defaultMessage='{checklist} - Item #{itemNumber}'
                                                        values={{
                                                            checklist: item.checklistTitle,
                                                            itemNumber: `${item.checklistIndex + 1}.${item.itemIndex + 1}`,
                                                        }}
                                                    />
                                                </ChecklistItemOptionMeta>
                                                {item.item.description && (
                                                    <ChecklistItemOptionDescription>
                                                        {item.item.description}
                                                    </ChecklistItemOptionDescription>
                                                )}
                                            </ChecklistItemOptionContent>
                                        </ChecklistItemOption>
                                    );
                                })}
                            </ChecklistItemSelector>
                        </AttachModalBody>
                    </AttachModalContent>
                </AttachModal>
            )}
        </JulienDevOuterContainer>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    border-radius: 8px;
    margin-top: 24px;
    overflow: hidden;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    font-size: 14px;
    font-weight: 600;
    color: var(--center-channel-color);

    i {
        font-size: 16px;
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

const RefreshButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    width: 24px;
    height: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
    }

    i {
        font-size: 14px;
    }
`;

const Content = styled.div`
    padding: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
`;

const ConditionsSection = styled.div`
    margin-top: 16px;
`;

const ConditionsSectionHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
`;

const CreateButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--button-bg);
    color: var(--button-color);
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.92);
    }

    i {
        font-size: 14px;
    }
`;

const CreateForm = styled.div`
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    border-radius: 4px;
    padding: 16px;
    margin-bottom: 16px;
`;

const FormHeader = styled.div`
    font-weight: 600;
    font-size: 14px;
    color: var(--center-channel-color);
    margin-bottom: 12px;
`;

const FormField = styled.div`
    margin-bottom: 12px;
`;

const FormLabel = styled.label`
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin-bottom: 4px;
`;

const ConditionBuilder = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
`;

const BuilderRow = styled.div`
    display: flex;
    gap: 12px;
    align-items: flex-end;

    & > * {
        flex: 1;
    }
`;

const Select = styled.select`
    width: 100%;
    padding: 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 12px;

    &:focus {
        outline: none;
        border-color: var(--button-bg);
    }

    &[multiple] {
        min-height: 80px;
    }
`;

const TextInput = styled.input`
    width: 100%;
    padding: 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 12px;

    &:focus {
        outline: none;
        border-color: var(--button-bg);
    }
`;

const FormActions = styled.div`
    display: flex;
    gap: 8px;
    justify-content: flex-end;
`;

const FormButton = styled.button<{secondary?: boolean}>`
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: ${(props) => (props.secondary ? 'transparent' : 'var(--button-bg)')};
    color: ${(props) => (props.secondary ? 'rgba(var(--center-channel-color-rgb), 0.72)' : 'var(--button-color)')};
    border: ${(props) => (props.secondary ? '1px solid rgba(var(--center-channel-color-rgb), 0.16)' : 'none')};

    &:hover {
        background: ${(props) => (props.secondary ? 'rgba(var(--center-channel-color-rgb), 0.04)' : 'rgba(var(--button-bg-rgb), 0.92)')};
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const SubHeader = styled.div`
    font-weight: 600;
    font-size: 13px;
    color: var(--center-channel-color);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
`;

const EmptyMessage = styled.div`
    font-style: italic;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const ConditionsList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const ConditionItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const ConditionHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const ConditionName = styled.span`
    font-weight: 600;
    color: var(--center-channel-color);
`;

const ConditionVersion = styled.span`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const ConditionId = styled.span`
    font-size: 11px;
    color: rgba(var(--center-channel-color-rgb), 0.48);
    font-family: Monaco, Consolas, monospace;
    margin-left: auto;
`;

const ConditionDetails = styled.div`
    margin-left: 8px;
    padding-left: 8px;
    border-left: 2px solid rgba(var(--center-channel-color-rgb), 0.12);
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const HumanReadableCondition = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(var(--button-bg-rgb), 0.08);
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
`;

const FieldName = styled.span`
    color: var(--center-channel-color);
    font-weight: 600;
`;

const Operator = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-style: italic;
`;

const ConditionValue = styled.span`
    color: var(--center-channel-color);
    font-weight: 600;
    padding: 2px 6px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 3px;
`;

const FieldType = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 11px;
    margin-left: auto;
`;

const ConditionJSON = styled.pre`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-family: Monaco, Consolas, monospace;
    margin: 0;
    padding: 8px;
    background: rgba(var(--center-channel-color-rgb), 0.02);
    border-radius: 3px;
    overflow-x: auto;
    white-space: pre-wrap;
    overflow-wrap: break-word;
`;

const ConditionUsageSection = styled.div`
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const ConditionUsageHeaderWithButton = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
`;

const AttachButton = styled.button`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 11px;
    background: var(--button-bg);
    color: var(--button-color);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.8);
    }

    i {
        font-size: 10px;
    }
`;

const ConditionUsageHeader = styled.div`
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin-bottom: 8px;
`;

const ConditionUsageEmpty = styled.div`
    font-size: 11px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-style: italic;
    padding: 8px;
    text-align: center;
    background: rgba(var(--center-channel-color-rgb), 0.02);
    border-radius: 4px;
`;

const ConditionUsageList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const ConditionUsageItem = styled.div`
    background: rgba(var(--center-channel-color-rgb), 0.02);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    padding: 8px;
`;

const ConditionUsageItemHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
`;

const ConditionUsageItemTitle = styled.div`
    font-size: 12px;
    font-weight: 500;
    color: var(--center-channel-color);
`;

const ConditionUsageItemLocation = styled.div`
    font-size: 10px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-family: Monaco, Consolas, monospace;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    padding: 2px 4px;
    border-radius: 2px;
`;

const ConditionUsageItemDetails = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
`;

const ConditionUsageDetail = styled.div`
    font-size: 10px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const AttachModal = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(0 0 0 / 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
`;

const AttachModalContent = styled.div`
    background: var(--center-channel-bg);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0 0 0 / 0.2);
    max-width: 600px;
    max-height: 80vh;
    width: 90%;
    display: flex;
    flex-direction: column;
`;

const AttachModalHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const AttachModalTitle = styled.div`
    font-size: 16px;
    font-weight: 600;
    color: var(--center-channel-color);
`;

const AttachModalCloseButton = styled.button`
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 18px;

    &:hover {
        color: var(--center-channel-color);
    }
`;

const AttachModalBody = styled.div`
    padding: 20px;
    overflow-y: auto;
    flex: 1;
`;

const AttachModalDescription = styled.div`
    font-size: 14px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin-bottom: 16px;
`;

const ChecklistItemSelector = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    padding: 8px;
`;

const ChecklistItemOption = styled.div<{$selected: boolean; $disabled?: boolean}>`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 4px;
    cursor: ${(props) => (props.$disabled ? 'not-allowed' : 'pointer')};
    opacity: ${(props) => (props.$disabled ? 0.5 : 1)};
    background: ${(props) => (props.$selected ? 'rgba(var(--button-bg-rgb), 0.1)' : 'transparent')
    };
    border: 1px solid ${(props) => (props.$selected ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.08)')
    };
    transition: all 0.15s ease;

    &:hover {
        background: ${(props) => {
            if (props.$disabled) {
                return 'transparent';
            }
            return props.$selected ? 'rgba(var(--button-bg-rgb), 0.15)' : 'rgba(var(--center-channel-color-rgb), 0.04)';
        }};
    }
`;

const ChecklistItemOptionContent = styled.div`
    flex: 1;
`;

const ChecklistItemOptionTitle = styled.div`
    font-size: 14px;
    font-weight: 500;
    color: var(--center-channel-color);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
`;

const DisabledBadge = styled.span`
    font-size: 10px;
    font-weight: 400;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    background: rgba(var(--center-channel-color-rgb), 0.08);
    padding: 2px 6px;
    border-radius: 10px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
`;

const ChecklistItemOptionMeta = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-bottom: 4px;
`;

const ChecklistItemOptionDescription = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-style: italic;
`;

const JulienDevOuterContainer = styled.div`
    height: 100%;
    grid-area: aside / aside / aside-right / aside-right;
`;

const JulienDevInnerContainer = styled.div`
    display: flex;
    max-width: 1120px;
    flex-direction: column;
    background: var(--center-channel-bg);
    border-radius: 8px;
    padding: 28px 32px;
    margin: 5rem auto;
    box-shadow: 0 4px 6px rgba(0 0 0 / 0.12);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
`;

export default JulienDevConditionEditor;