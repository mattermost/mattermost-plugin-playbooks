// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';

import {
    DragDropContext,
    Draggable,
    Droppable,
    DropResult,
    DroppableProvided,
    DraggableProvided,
} from 'react-beautiful-dnd';

import {Checklist, ChecklistItem} from 'src/types/playbook';

import {ChecklistItemDetails, ChecklistItemDetailsEdit} from './checklist_item';

interface Props {
    checklist: Checklist;
    onChange?: (itemNum: number, checked: boolean) => void;
    addItem: (checklistItem: ChecklistItem) => void;
    removeItem: (itemNum: number) => void;
    editItem: (itemNum: number, newTitle: string) => void;
    reorderItems: (itemNum: number, newPosition: number) => void;
}

export const ChecklistDetails = ({checklist, onChange, addItem, removeItem, editItem, reorderItems}: Props): React.ReactElement<Props> => {
    const [newvalue, setNewValue] = useState('');
    const [inputExpanded, setInputExpanded] = useState(false);
    const [editMode, setEditMode] = useState(false);

    const [checklistItems, setChecklistItems] = useState(checklist.items);

    const reorder = (list: ChecklistItem[], startIndex: number, endIndex: number) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);

        return result;
    };

    useEffect(() => {
        setChecklistItems(checklist.items);
    }, [checklist.items]);

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return;
        }

        if (result.destination.index === result.source.index) {
            return;
        }

        setChecklistItems(reorder(checklistItems, result.source.index, result.destination.index));
        reorderItems(result.source.index, result.destination.index);
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
                                checklistItem={checklistItems[rubric.source.index]}
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
                    {(droppableProvided: DroppableProvided) => (
                        <div
                            ref={droppableProvided.innerRef}
                            {...droppableProvided.droppableProps}
                            className='checklist'
                        >
                            {checklistItems.map((checklistItem: ChecklistItem, index: number) => {
                                if (editMode) {
                                    return (
                                        <Draggable
                                            index={index}
                                            key={checklistItem.title + index}
                                            draggableId={checklistItem.title + index}
                                        >
                                            {(draggableProvided: DraggableProvided) => {
                                                return (
                                                    <div
                                                        ref={draggableProvided.innerRef}
                                                        {...draggableProvided.draggableProps}
                                                        {...draggableProvided.dragHandleProps}
                                                        style={draggableProvided.draggableProps.style}
                                                    >
                                                        <ChecklistItemDetailsEdit
                                                            checklistItem={checklistItem}
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
                            {droppableProvided.placeholder}
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

