// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import {Droppable, DroppableProvided} from 'react-beautiful-dnd';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {Checklist, ChecklistItem, emptyChecklistItem} from 'src/types/playbook';
import DraggableChecklistItem from 'src/components/checklist_item/checklist_item_draggable';
import {ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';
import {PlaybookRun} from 'src/types/playbook_run';
import {Condition, ConditionExprV1} from 'src/types/conditions';
import {PropertyField} from 'src/types/properties';

import ConditionalGroup from './conditional_group';

// disable all react-beautiful-dnd development warnings
// @ts-ignore
window['__react-beautiful-dnd-disable-dev-warnings'] = true;

interface Props {
    id: string
    playbookRun?: PlaybookRun
    playbookId?: string,
    readOnly: boolean;
    checklist: Checklist;
    checklistIndex: number;
    onUpdateChecklist: (newChecklist: Checklist) => void;
    showItem?: (checklistItem: ChecklistItem, myId: string) => boolean
    itemButtonsFormat?: ItemButtonsFormat;
    onReadOnlyInteract?: () => void;
    conditions?: Condition[];
    propertyFields?: PropertyField[];
    onDeleteCondition?: (conditionId: string) => void;
    onCreateCondition?: (expr: ConditionExprV1, itemIndex: number) => void;
    onUpdateCondition?: (conditionId: string, expr: ConditionExprV1) => void;
}

const GenericChecklist = (props: Props) => {
    const {formatMessage} = useIntl();
    const myUser = useSelector(getCurrentUser);
    const [addingItem, setAddingItem] = useState(false);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

    const onUpdateChecklistItem = (index: number, newItem: ChecklistItem) => {
        const newChecklistItems = [...props.checklist.items];
        newChecklistItems[index] = newItem;
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    const onAddChecklistItem = (newItem: ChecklistItem) => {
        const newChecklistItems = [...props.checklist.items];
        newChecklistItems.push(newItem);
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    const onDuplicateChecklistItem = (index: number) => {
        const newChecklistItems = [...props.checklist.items];
        const duplicate = {
            ...newChecklistItems[index],
            id: `temp_item_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        };
        newChecklistItems.splice(index + 1, 0, duplicate);
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    const onDeleteChecklistItem = (index: number) => {
        const newChecklistItems = [...props.checklist.items];
        newChecklistItems.splice(index, 1);
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    const onOpenConditionEditor = (index: number) => {
        // Create a default condition directly with the first available field
        if (props.propertyFields && props.propertyFields.length > 0 && props.onCreateCondition) {
            const firstField = props.propertyFields.find((field) =>
                field.type === 'text' || field.type === 'select' || field.type === 'multiselect'
            );

            if (firstField) {
                let defaultValue: string | string[] = '';
                if (firstField.type === 'select' || firstField.type === 'multiselect') {
                    // Use first option if available
                    defaultValue = firstField.attrs.options?.[0]?.id ? [firstField.attrs.options[0].id] : [];
                }

                const expr: ConditionExprV1 = {
                    is: {
                        field_id: firstField.id,
                        value: defaultValue,
                    },
                };

                props.onCreateCondition(expr, index);
            }
        }
    };

    // Check if we can add conditionals (need property fields)
    const canAddConditional = props.propertyFields && props.propertyFields.length > 0 &&
        props.propertyFields.some((field) => field.type === 'text' || field.type === 'select' || field.type === 'multiselect');

    const onRemoveFromCondition = (index: number) => {
        const item = props.checklist.items[index];
        const conditionId = item.condition_id;

        const newChecklistItems = [...props.checklist.items];
        newChecklistItems[index] = {...newChecklistItems[index], condition_id: ''};
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);

        // Check if this was the last item with this condition_id
        if (conditionId) {
            const remainingItemsWithCondition = newChecklistItems.filter((item) => item.condition_id === conditionId);
            if (remainingItemsWithCondition.length === 0 && props.onDeleteCondition) {
                // Delete the condition group since it's now empty
                props.onDeleteCondition(conditionId);
            }
        }
    };

    const onAssignToCondition = (index: number, conditionId: string) => {
        const newChecklistItems = [...props.checklist.items];
        newChecklistItems[index] = {...newChecklistItems[index], condition_id: conditionId};
        const newChecklist = {...props.checklist};
        newChecklist.items = newChecklistItems;
        props.onUpdateChecklist(newChecklist);
    };

    // Group items by condition_id and create ordered list
    const groupedItems: {[key: string]: ChecklistItem[]} = {};
    const itemIndexMap = new Map<ChecklistItem, number>(); // Track original indices
    const conditionFirstIndex = new Map<string, number>(); // Track first occurrence of each condition

    // Build groups and track indices
    props.checklist.items.forEach((item, index) => {
        itemIndexMap.set(item, index);

        // Filter items based on showItem prop
        if (props.showItem && !props.showItem(item, myUser.id)) {
            return;
        }

        if (item.condition_id) {
            if (!groupedItems[item.condition_id]) {
                groupedItems[item.condition_id] = [];
                conditionFirstIndex.set(item.condition_id, index);
            }
            groupedItems[item.condition_id].push(item);
        }
    });

    // Create ordered list of items and groups
    type OrderedEntry = {
        type: 'item' | 'group';
        item?: ChecklistItem;
        conditionId?: string;
        index: number; // Position in original array
    };

    const orderedEntries: OrderedEntry[] = [];
    const processedConditions = new Set<string>();

    props.checklist.items.forEach((item, index) => {
        // Skip filtered items
        if (props.showItem && !props.showItem(item, myUser.id)) {
            return;
        }

        if (item.condition_id) {
            // Add condition group only once at the first item's position
            if (!processedConditions.has(item.condition_id)) {
                orderedEntries.push({
                    type: 'group',
                    conditionId: item.condition_id,
                    index: conditionFirstIndex.get(item.condition_id) || index,
                });
                processedConditions.add(item.condition_id);
            }
        } else {
            // Regular ungrouped item
            orderedEntries.push({
                type: 'item',
                item,
                index,
            });
        }
    });

    // Use item IDs for unique React keys, fallback to title-based keys for items without IDs
    const rawKeys = props.checklist.items.map((item) => item.id || (props.id + item.title));
    const keys = generateKeys(rawKeys);

    const renderChecklistItem = (checklistItem: ChecklistItem, index: number, dragIndex?: number) => {
        // dragIndex is used for the Draggable component (group-relative position)
        // index is used for all callbacks (flat array position)
        const draggableIndex = dragIndex === undefined ? index : dragIndex;

        return (
            <DraggableChecklistItem
                key={keys[index]}
                playbookRun={props.playbookRun}
                playbookId={props.playbookId}
                readOnly={props.readOnly}
                dragDisabled={addingItem || editingItemIndex !== null}
                checklistIndex={props.checklistIndex}
                item={checklistItem}
                itemIndex={draggableIndex}
                newItem={false}
                cancelAddingItem={() => {
                    setAddingItem(false);
                }}
                onUpdateChecklistItem={(newItem: ChecklistItem) => onUpdateChecklistItem(index, newItem)}
                onDuplicateChecklistItem={() => onDuplicateChecklistItem(index)}
                onDeleteChecklistItem={() => onDeleteChecklistItem(index)}
                itemButtonsFormat={props.itemButtonsFormat}
                onReadOnlyInteract={props.onReadOnlyInteract}
                onAddConditional={canAddConditional ? () => onOpenConditionEditor(index) : undefined}
                onRemoveFromCondition={() => onRemoveFromCondition(index)}
                onAssignToCondition={(conditionId) => onAssignToCondition(index, conditionId)}
                availableConditions={(props.conditions || []).filter((condition) => {
                    const currentItem = props.checklist.items[index];
                    // Only show conditions that:
                    // 1. Have at least one item
                    // 2. Are not the condition this item is already in
                    return condition.id !== currentItem.condition_id &&
                        props.checklist.items.some((item) => item.condition_id === condition.id);
                })}
                onEditingChange={(isEditing) => {
                    setEditingItemIndex(isEditing ? index : null);
                }}
            />
        );
    };

    // Determine if drag and drop should be disabled
    const isDragDropDisabled = addingItem || editingItemIndex !== null;

    return (
        <Droppable
            droppableId={props.checklistIndex.toString()}
            direction='vertical'
            type='checklist-item'
            isDropDisabled={isDragDropDisabled}
        >
            {(droppableProvided: DroppableProvided) => (
                <ChecklistContainer className='checklist'>
                    <div
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                    >
                        {/* Render items and groups in order */}
                        {orderedEntries.map((entry, entryIdx) => {
                            if (entry.type === 'item' && entry.item) {
                                const index = itemIndexMap.get(entry.item)!;
                                return renderChecklistItem(entry.item, index);
                            }

                            if (entry.type === 'group' && entry.conditionId) {
                                const conditionId = entry.conditionId;
                                const condition = props.conditions?.find((c) => c.id === conditionId);

                                if (!condition) {
                                    // If condition not found, render items as ungrouped
                                    return groupedItems[conditionId]?.map((checklistItem) => {
                                        const index = itemIndexMap.get(checklistItem)!;
                                        return renderChecklistItem(checklistItem, index);
                                    });
                                }

                                return (
                                    <ConditionalGroup
                                        key={conditionId}
                                        condition={condition}
                                        items={groupedItems[conditionId] || []}
                                        checklistIndex={props.checklistIndex}
                                        itemIndex={entryIdx}
                                        propertyFields={props.propertyFields || []}
                                        onDeleteCondition={props.onDeleteCondition}
                                        onUpdateCondition={props.onUpdateCondition}
                                        dragDisabled={isDragDropDisabled}
                                    >
                                        {(groupedItems[conditionId] || []).map((checklistItem, groupItemIndex) => {
                                            const originalIndex = itemIndexMap.get(checklistItem)!;

                                            // Pass both originalIndex (for callbacks) and groupItemIndex (for dragging)
                                            return renderChecklistItem(checklistItem, originalIndex, groupItemIndex);
                                        })}
                                    </ConditionalGroup>
                                );
                            }

                            return null;
                        })}

                        {addingItem &&
                            <DraggableChecklistItem
                                key={'new_checklist_item'}
                                playbookRun={props.playbookRun}
                                playbookId={props.playbookId}
                                readOnly={props.readOnly}
                                dragDisabled={true}
                                checklistIndex={props.checklistIndex}
                                item={emptyChecklistItem()}
                                itemIndex={-1}
                                newItem={true}
                                cancelAddingItem={() => {
                                    setAddingItem(false);
                                }}
                                onAddChecklistItem={onAddChecklistItem}
                                itemButtonsFormat={props.itemButtonsFormat}
                                onReadOnlyInteract={props.onReadOnlyInteract}
                                onEditingChange={(isEditing) => {
                                    // New item is always in editing mode, so we don't need to track it separately
                                    // addingItem state already handles disabling drag & drop
                                }}
                            />
                        }
                        {droppableProvided.placeholder}
                        {props.readOnly ? null : (
                            <AddTaskLink
                                disabled={props.readOnly}
                                onClick={() => {
                                    setAddingItem(true);
                                }}
                                data-testid={`add-new-task-${props.checklistIndex}`}
                            >
                                <IconWrapper>
                                    <i className='icon icon-plus'/>
                                </IconWrapper>
                                {formatMessage({defaultMessage: 'Add a task'})}
                            </AddTaskLink>
                        )}
                    </div>
                </ChecklistContainer>
            )}
        </Droppable>
    );
};

const IconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

const ChecklistContainer = styled.div`
    padding: 8px 0;
    border:  1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 0 0 4px 4px;
    border-top: 0;
    background-color: var(--center-channel-bg);
`;

const AddTaskLink = styled.button`
    display: flex;
    width: 100%;
    height: 44px;
    flex-direction: row;
    align-items: center;
    border: none;
    background: none;
    color: var(--center-channel-color-64);
    cursor: pointer;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;

    &:hover:not(:disabled) {
        background-color: var(--button-bg-08);
        color: var(--button-bg);
    }
`;

export const generateKeys = (arr: string[]): string[] => {
    const keys: string[] = [];
    const itemsMap = new Map<string, number>();
    for (let i = 0; i < arr.length; i++) {
        const num = itemsMap.get(arr[i]) || 0;
        keys.push(arr[i] + String(num));
        itemsMap.set(arr[i], num + 1);
    }
    return keys;
};

export default GenericChecklist;
