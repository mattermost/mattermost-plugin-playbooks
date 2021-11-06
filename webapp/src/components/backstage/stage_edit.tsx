// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    Draggable,
    Droppable,
    DroppableProvided,
    DraggableProvided,
} from 'react-beautiful-dnd';

import styled from 'styled-components';

import {FormattedMessage} from 'react-intl';

import {Checklist, ChecklistItem, ChecklistItemState, newChecklistItem} from 'src/types/playbook';

import {TertiaryButton} from 'src/components/assets/buttons';

import CollapsibleSection from './collapsible_section';
import StepEdit from './step_edit';
import DragHandle from './drag_handle';

const DragPlaceholderText = styled.div`
    border: 2px dashed rgb(var(--button-bg-rgb));
    border-radius: 5px;
    padding: 30px;
    margin: 5px 50px;
    text-align: center;
    color: rgb(var(--button-bg-rgb));
    cursor: pointer;
`;

interface Props {
    checklist: Checklist;
    checklistIndex: number;
    onChange: (checklist: Checklist) => void;
}

export const StageEditor = (props: Props): React.ReactElement => {
    const onTitleChange = (newTitle: string) => {
        const trimmedTitle = newTitle.trim();
        if (trimmedTitle.length === 0) {
            // Keep the original title from the props.
            return;
        }

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

    const handleAddChecklistItem = () => {
        onAddChecklistItem(newChecklistItem('', '', '', ChecklistItemState.Open));
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
                        {props.checklist.items.length > 0 ? props.checklist.items.map((checklistItem: ChecklistItem, idx: number) => (
                            <Draggable
                                index={idx}
                                key={props.checklistIndex + checklistItem.title + idx}
                                draggableId={props.checklistIndex + checklistItem.title + idx}
                            >
                                {(draggableProvided: DraggableProvided) => (
                                    <DragHandle
                                        step={true}
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
                        )) : (
                            <DragPlaceholderText
                                onClick={handleAddChecklistItem}
                            >
                                <FormattedMessage defaultMessage='Drag and drop an existing task or click to create a new task.'/>
                            </DragPlaceholderText>
                        )}
                        {droppableProvided.placeholder}
                    </div>
                )}
            </Droppable>
            <TertiaryButton
                className='mt-3'
                onClick={handleAddChecklistItem}
            >
                <i className='icon-plus'/>
                <FormattedMessage defaultMessage='New task'/>
            </TertiaryButton>
        </CollapsibleSection>
    );
};
