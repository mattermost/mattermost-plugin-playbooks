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

    // Use items directly from the checklist array
    const sortedItems = props.checklist.items;

    // Use item IDs for unique React keys, fallback to title-based keys for items without IDs
    const rawKeys = sortedItems.map((item) => item.id || (props.id + item.title));
    const keys = generateKeys(rawKeys);

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
                        {sortedItems.map((checklistItem: ChecklistItem, sortedIndex: number) => {
                            // filtering here because we need to maintain the index values
                            // because we refer to checklist items by their index
                            if (props.showItem ? !props.showItem(checklistItem, myUser.id) : false) {
                                return null;
                            }

                            return (
                                <DraggableChecklistItem
                                    key={keys[sortedIndex]}
                                    playbookRun={props.playbookRun}
                                    playbookId={props.playbookId}
                                    readOnly={props.readOnly}
                                    checklistIndex={props.checklistIndex}
                                    item={checklistItem}
                                    itemIndex={sortedIndex}
                                    newItem={false}
                                    cancelAddingItem={() => {
                                        setAddingItem(false);
                                    }}
                                    onUpdateChecklistItem={(newItem: ChecklistItem) => onUpdateChecklistItem(sortedIndex, newItem)}
                                    onDuplicateChecklistItem={() => onDuplicateChecklistItem(sortedIndex)}
                                    onDeleteChecklistItem={() => onDeleteChecklistItem(sortedIndex)}
                                    itemButtonsFormat={props.itemButtonsFormat}
                                    onReadOnlyInteract={props.onReadOnlyInteract}
                                />
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
