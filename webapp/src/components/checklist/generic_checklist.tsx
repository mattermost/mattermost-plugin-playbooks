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
import {Condition} from 'src/types/conditions';
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
}

const GenericChecklist = (props: Props) => {
    const {formatMessage} = useIntl();
    const myUser = useSelector(getCurrentUser);
    const [addingItem, setAddingItem] = useState(false);

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

    // Group items by condition_id
    const groupedItems: {[key: string]: ChecklistItem[]} = {};
    const ungroupedItems: ChecklistItem[] = [];
    const itemIndexMap = new Map<ChecklistItem, number>(); // Track original indices

    props.checklist.items.forEach((item, index) => {
        itemIndexMap.set(item, index);

        // Filter items based on showItem prop
        if (props.showItem && !props.showItem(item, myUser.id)) {
            return;
        }

        if (item.condition_id) {
            if (!groupedItems[item.condition_id]) {
                groupedItems[item.condition_id] = [];
            }
            groupedItems[item.condition_id].push(item);
        } else {
            ungroupedItems.push(item);
        }
    });

    // Use item IDs for unique React keys, fallback to title-based keys for items without IDs
    const rawKeys = props.checklist.items.map((item) => item.id || (props.id + item.title));
    const keys = generateKeys(rawKeys);

    const renderChecklistItem = (checklistItem: ChecklistItem, index: number) => {
        return (
            <DraggableChecklistItem
                key={keys[index]}
                playbookRun={props.playbookRun}
                playbookId={props.playbookId}
                readOnly={props.readOnly}
                checklistIndex={props.checklistIndex}
                item={checklistItem}
                itemIndex={index}
                newItem={false}
                cancelAddingItem={() => {
                    setAddingItem(false);
                }}
                onUpdateChecklistItem={(newItem: ChecklistItem) => onUpdateChecklistItem(index, newItem)}
                onDuplicateChecklistItem={() => onDuplicateChecklistItem(index)}
                onDeleteChecklistItem={() => onDeleteChecklistItem(index)}
                itemButtonsFormat={props.itemButtonsFormat}
                onReadOnlyInteract={props.onReadOnlyInteract}
            />
        );
    };

    return (
        <Droppable
            droppableId={props.checklistIndex.toString()}
            direction='vertical'
            type='checklist-item'
        >
            {(droppableProvided: DroppableProvided) => (
                <ChecklistContainer className='checklist'>
                    <div
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                    >
                        {/* Render ungrouped items first */}
                        {ungroupedItems.map((checklistItem: ChecklistItem) => {
                            const index = itemIndexMap.get(checklistItem)!;
                            return renderChecklistItem(checklistItem, index);
                        })}

                        {/* Render conditional groups */}
                        {props.conditions && props.propertyFields && Object.keys(groupedItems).map((conditionId) => {
                            const condition = props.conditions!.find((c) => c.id === conditionId);
                            if (!condition) {
                                // If condition not found, render items as ungrouped
                                return groupedItems[conditionId].map((checklistItem) => {
                                    const index = itemIndexMap.get(checklistItem)!;
                                    return renderChecklistItem(checklistItem, index);
                                });
                            }

                            return (
                                <ConditionalGroup
                                    key={conditionId}
                                    condition={condition}
                                    items={groupedItems[conditionId]}
                                    checklistIndex={props.checklistIndex}
                                    propertyFields={props.propertyFields!}
                                    onDeleteCondition={props.onDeleteCondition}
                                >
                                    {groupedItems[conditionId].map((checklistItem) => {
                                        const index = itemIndexMap.get(checklistItem)!;
                                        return renderChecklistItem(checklistItem, index);
                                    })}
                                </ConditionalGroup>
                            );
                        })}

                        {addingItem &&
                            <DraggableChecklistItem
                                key={'new_checklist_item'}
                                playbookRun={props.playbookRun}
                                playbookId={props.playbookId}
                                readOnly={props.readOnly}
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
