// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd';

import {Checklist, ChecklistItem} from 'src/types/playbook';

import {ChecklistItemDetails, ChecklistItemDetailsEdit} from './checklist_item';

interface ChecklistDetailsProps {
    checklist: Checklist;
    onChange?: (itemNum: number, checked: boolean) => void;
    addItem: (checklistItem: ChecklistItem) => void;
    removeItem: (itemNum: number) => void;
    editItem: (itemNum: number, newTitle: string) => void;
}

export const ChecklistDetails = ({checklist, onChange, addItem, removeItem, editItem}: ChecklistDetailsProps): React.ReactElement<ChecklistDetailsProps> => {
    const [newvalue, setNewValue] = useState('');
    const [inputExpanded, setInputExpanded] = useState(false);
    const [editMode, setEditMode] = useState(false);

    const [tempChecklistItems, setTmpChecklistItems] = useState(checklist.items);

    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);

        return result;
    };

    const onDragEnd = (result: any) => {
        if (!result.destination) {
            return;
        }

        if (result.destination.index === result.source.index) {
            return;
        }

        setTmpChecklistItems(reorder(tempChecklistItems, result.source.index, result.destination.index));
    };

    return (
        <div
            key={checklist.title}
            className='inner-container'
        >
            <div className='title'>
                {checklist.title}
                {' '}
                <a
                    onClick={() => {
                        setEditMode(!editMode);
                    }}
                >
                    <strong>{editMode ? '(done)' : '(edit)'}</strong>
                </a>
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable
                    droppableId='droppable'
                    renderClone={(provided, snapshot, rubric) => (
                        <div
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            ref={provided.innerRef}
                        >
                            <ChecklistItemDetailsEdit
                                checklistItem={tempChecklistItems[rubric.source.index]}
                                onEdit={(editedTo: string) => {
                                    editItem(rubric.source.index, editedTo);
                                }}
                                onRemove={() => {
                                    removeItem(rubric.source.index);
                                }}
                            />
                        </div>
                    )}
                >
                    {(provided) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className='checklist'
                        >
                            {tempChecklistItems.map((checklistItem: ChecklistItem, index: number) => {
                                if (editMode) {
                                    return (
                                        <Draggable
                                            index={index}
                                            key={checklistItem.title + index}
                                            draggableId={checklistItem.title + index}
                                        >
                                            {(provided, snapshot) => {
                                                return (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        style={provided.draggableProps.style}
                                                    >
                                                        <ChecklistItemDetailsEdit
                                                            checklistItem={checklistItem}
                                                            index={index}
                                                            onEdit={(editedTo: string) => {
                                                                editItem(index, editedTo);
                                                            }}
                                                            onRemove={() => {
                                                                removeItem(index);
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            }}
                                        </Draggable>
                                    );
                                }

                                return (
                                    <ChecklistItemDetails
                                        key={checklistItem.title + index}
                                        checklistItem={checklistItem}
                                        onChange={(checked: boolean) => {
                                            if (onChange) {
                                                onChange(index, checked);
                                            }
                                        }}
                                    />
                                );
                            })}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
            {inputExpanded &&
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        addItem({
                            title: newvalue,
                            checked: false,
                        });
                        setNewValue('');
                        setInputExpanded(false);
                    }}
                >
                    <input
                        type='text'
                        value={newvalue}
                        className='checklist-input'
                        placeholder={'Enter a new item'}
                        onChange={(e) => setNewValue(e.target.value)}
                    />
                </form>
            }
            {!inputExpanded &&
            <div>
                <a
                    onClick={() => {
                        setInputExpanded(true);
                    }}
                ><strong>{'+ Add new checklist item'}</strong></a>
            </div>
            }
        </div>
    );
};

