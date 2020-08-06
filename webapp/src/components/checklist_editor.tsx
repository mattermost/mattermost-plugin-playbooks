// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {
    Draggable,
    Droppable,
    DroppableProvided,
    DraggableProvided,
} from 'react-beautiful-dnd';

import {Checklist, ChecklistItem, ChecklistItemState} from 'src/types/playbook';

import {ChecklistItemDetailsEdit} from './checklist_item';
import './checklist.scss';

interface Props {
    checklist: Checklist;
    checklistIndex: number;
    onChange: (checklist: Checklist) => void;
    onRemove: () => void;
}

export const ChecklistEditor = ({
    checklist,
    checklistIndex,
    onChange,
    onRemove,
}: Props): React.ReactElement => {
    const [newValue, setNewValue] = useState('');
    const [checklistTitle, setChecklistTitle] = useState(checklist.title);
    const [inputExpanded, setInputExpanded] = useState(false);

    const onEscapeKey = (e: {key: string}) => {
        if (e.key === 'Escape') {
            setNewValue('');
            setInputExpanded(false);
        }
    };

    const onTitleChange = () => {
        const trimmedTitle = checklistTitle.trim();
        if (trimmedTitle === '') {
            setChecklistTitle(checklist.title);
            return;
        }
        if (trimmedTitle !== checklist.title) {
            const newChecklist = {
                ...checklist,
                title: trimmedTitle,
            } as Checklist;
            onChange(newChecklist);
        }
    };

    const onAddChecklistItem = (item: ChecklistItem) => {
        const newChecklist = {
            ...checklist,
            items: [...checklist.items, item],
        } as Checklist;
        onChange(newChecklist);
    };

    const onChangeChecklistItem = (checklistItemIndex: number, item: ChecklistItem) => {
        const newChecklist = {
            ...checklist,
            items: [...checklist.items],
        } as Checklist;
        newChecklist.items[checklistItemIndex] = item;
        onChange(newChecklist);
    };

    const onRemoveChecklistItem = (checklistItemIndex: number) => {
        const newChecklist = {
            ...checklist,
            items: [...checklist.items],
        } as Checklist;
        newChecklist.items.splice(checklistItemIndex, 1);
        onChange(newChecklist);
    };

    return (
        <Draggable
            draggableId={checklist.title + checklistIndex}
            index={checklistIndex}
        >
            {(rootDraggableProvided: DraggableProvided) => (
                <div
                    ref={rootDraggableProvided.innerRef}
                    {...rootDraggableProvided.draggableProps}
                    style={rootDraggableProvided.draggableProps.style}
                    className={'checklist-editor-inner-container'}
                >
                    <div
                        {...rootDraggableProvided.dragHandleProps}
                        className='title'
                        onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
                            if (event.defaultPrevented) {
                                return;
                            }
                            event.currentTarget.focus();
                        }}
                    >
                        {
                            <i
                                className='icon icon-menu pr-2'
                            />
                        }
                        <input
                            className='form-control input-name'
                            type='text'
                            placeholder='Default Stage'
                            value={checklistTitle}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={onTitleChange}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    onTitleChange();
                                }
                            }}
                            onChange={(e) => {
                                setChecklistTitle(e.target.value);
                            }}
                        />
                        {' '}
                        <span
                            onClick={onRemove}
                            className='checkbox-container__close'
                        >
                            <i className='icon icon-close'/>
                        </span>
                    </div>

                    <Droppable
                        droppableId={String(checklistIndex)}
                        type='checklist_item'
                    >
                        {(droppableProvided: DroppableProvided) => (
                            <div
                                ref={droppableProvided.innerRef}
                                {...droppableProvided.droppableProps}
                                className='checklist-item-container'
                            >
                                {
                                    !checklist.items.length &&
                                    <div className='light mt-1 mb-2'>{'You don\'t have any checklist items to edit yet.'}</div>
                                }
                                {checklist.items.map((checklistItem: ChecklistItem, idx: number) => (
                                    <Draggable
                                        index={idx}
                                        key={checklistIndex + checklistItem.title + idx}
                                        draggableId={checklistIndex + checklistItem.title + idx}
                                    >
                                        {(draggableProvided: DraggableProvided) => {
                                            return (
                                                <div className='checklist-item-containerz'>
                                                    <div
                                                        ref={draggableProvided.innerRef}
                                                        {...draggableProvided.draggableProps}
                                                        {...draggableProvided.dragHandleProps}
                                                        style={draggableProvided.draggableProps.style}
                                                    >
                                                        <ChecklistItemDetailsEdit
                                                            commandInputId={`commandInput-${checklistIndex}-${idx}`}
                                                            checklistItem={checklistItem}
                                                            onEdit={(item: ChecklistItem) => {
                                                                onChangeChecklistItem(idx, item);
                                                            }}
                                                            onRemove={() => {
                                                                onRemoveChecklistItem(idx);
                                                            }}
                                                        />

                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </Draggable>
                                ))}
                                {droppableProvided.placeholder}
                            </div>
                        )}
                    </Droppable>
                    {inputExpanded &&
                    <div
                        className='checklist-item-container'
                    >
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (newValue.trim() === '') {
                                    setInputExpanded(false);
                                    return;
                                }
                                onAddChecklistItem({
                                    title: newValue,
                                    state: ChecklistItemState.Open,
                                    command: '',
                                    description: '',
                                });
                                setNewValue('');
                                setInputExpanded(false);
                            }}
                        >
                            <input
                                autoFocus={true}
                                type='text'
                                value={newValue}
                                className='form-control mt-2'
                                placeholder={'Enter a new item'}
                                onKeyDown={(e) => onEscapeKey(e)}
                                onChange={(e) => setNewValue(e.target.value)}
                            />
                            <small className='light mt-1 d-block'>{'Press Enter to Add Item or Escape to Cancel'}</small>
                        </form>
                    </div>
                    }
                    {!inputExpanded &&
                    <div className='checklist-item-container checklist-new-item'>
                        <a
                            href='#'
                            onClick={() => {
                                setInputExpanded(true);
                            }}
                        >
                            <i className='icon icon-plus'/>
                            {'Add new checklist item'}
                        </a>
                    </div>
                    }
                </div>
            )}
        </Draggable>
    );
};
