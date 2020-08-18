// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {
    Draggable,
    Droppable,
    DroppableProvided,
    DraggableProvided,
} from 'react-beautiful-dnd';

import styled from 'styled-components';

import {Checklist, ChecklistItem, ChecklistItemState} from 'src/types/playbook';

import {ChecklistItemDetailsEdit} from 'src/components/checklist_item';

import CollapsibleSection from './collapsible_section';
import StepEdit from './step_edit';
import DragHandle from './drag_handle';

const NewStep = styled.button`
    display: block;
    border: none;
    background: none;
    color: rgb(var(--button-bg-rgb));
    margin-top: 8px;
    margin-left: 25px;
`;

interface Props {
    checklist: Checklist;
    checklistIndex: number;
    onChange: (checklist: Checklist) => void;
    onRemove: () => void;
}

export const StageEditor = (props: Props): React.ReactElement => {
    const onTitleChange = (newTitle: string) => {
        const trimmedTitle = newTitle.trim();
        const newChecklist = {
            ...props.checklist,
            title: trimmedTitle,
        } as Checklist;
        props.onChange(newChecklist);
    };

    const onAddChecklistItem = (item: ChecklistItem) => {
        const newChecklist = {
            ...props.checklist,
            items: [...props.checklist.items, item],
        } as Checklist;
        props.onChange(newChecklist);
    };

    const onChangeChecklistItem = (checklistItemIndex: number, item: ChecklistItem) => {
        const newChecklist = {
            ...props.checklist,
            items: [...props.checklist.items],
        } as Checklist;
        newChecklist.items[checklistItemIndex] = item;
        props.onChange(newChecklist);
    };

    const onRemoveChecklistItem = (checklistItemIndex: number) => {
        const newChecklist = {
            ...props.checklist,
            items: [...props.checklist.items],
        } as Checklist;
        newChecklist.items.splice(checklistItemIndex, 1);
        props.onChange(newChecklist);
    };

    return (
        <CollapsibleSection
            title={props.checklist.title}
            onTitleChange={onTitleChange}
        >
            <Droppable
                droppableId={String(props.checklistIndex)}
                type='checklist_item'
            >
                {(droppableProvided: DroppableProvided) => (
                    <div
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                    >
                        {props.checklist.items.map((checklistItem: ChecklistItem, idx: number) => (
                            <Draggable
                                index={idx}
                                key={props.checklistIndex + checklistItem.title + idx}
                                draggableId={props.checklistIndex + checklistItem.title + idx}
                            >
                                {(draggableProvided: DraggableProvided) => (
                                    <DragHandle
                                        draggableProvided={draggableProvided}
                                        onDelete={() => onRemoveChecklistItem(idx)}
                                    >
                                        <StepEdit
                                            autocompleteOnBottom={props.checklistIndex === 0 && idx === 0}
                                            step={checklistItem}
                                            onUpdate={(updatedStep: ChecklistItem) => {
                                                onChangeChecklistItem(idx, updatedStep);
                                            }}
                                        />
                                    </DragHandle>
                                )}
                            </Draggable>
                        ))}
                        {droppableProvided.placeholder}
                    </div>
                )}
            </Droppable>
            <NewStep
                onClick={() => {
                    onAddChecklistItem({
                        title: '',
                        state: ChecklistItemState.Open,
                        command: '',
                        description: '',
                    });
                }}
            >
                <i className='icon-plus'/>
                {'New Step'}
            </NewStep>
        </CollapsibleSection>
    );
};
