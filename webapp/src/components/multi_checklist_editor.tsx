// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    DragDropContext,
    Droppable,
    DropResult,
    DroppableProvided,
} from 'react-beautiful-dnd';

import {Checklist, emptyChecklist} from 'src/types/playbook';

import {ChecklistEditor} from './checklist_editor';
import './checklist_editor.scss';

interface Props {
    checklist: Checklist[];
    onChange: (checklist: Checklist[]) => void;
}

export const MultiChecklistEditor = ({
    checklist: propChecklist = [],
    onChange,
}: Props): React.ReactElement => {
    const onDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return;
        }

        if (result.destination.droppableId === result.source.droppableId &&
                result.destination.index === result.source.index) {
            return;
        }

        if (result.type === 'checklist') {
            onReorderChecklist(result.source.index, result.destination.index);
            return;
        }

        if (result.type === 'checklist_item') {
            const sourceChecklistIndex = result.source.droppableId;
            const destinationChecklistIndex = result.destination.droppableId;
            onReorderChecklistItem(Number(sourceChecklistIndex), Number(destinationChecklistIndex), result.source.index, result.destination.index);
        }
    };

    const onReorderChecklist = (sourceIndex: number, destinationIndex: number) => {
        const newChecklist = [...propChecklist];
        const [removed] = newChecklist.splice(sourceIndex, 1);
        newChecklist.splice(destinationIndex, 0, removed);

        onChange(newChecklist);
    };

    const onReorderChecklistItem = (checklistIndex: number, newChecklistIndex: number, checklistItemIndex: number, newChecklistItemIndex: number): void => {
        const newChecklist = [...propChecklist];

        if (checklistIndex === newChecklistIndex) {
            // items moved within stage
            const changedChecklist = {...newChecklist[checklistIndex]} as Checklist;
            const changedChecklistItems = [...changedChecklist.items];
            const [removed] = changedChecklistItems.splice(checklistItemIndex, 1);
            changedChecklistItems.splice(newChecklistItemIndex, 0, removed);
            changedChecklist.items = changedChecklistItems;

            newChecklist[checklistIndex] = changedChecklist;
            onChange(newChecklist);
            return;
        }

        // items moved between stages
        const sourceChangedChecklist = {...newChecklist[checklistIndex]} as Checklist;
        const destinationChangedChecklist = {...newChecklist[newChecklistIndex]} as Checklist;
        const itemToMove = sourceChangedChecklist.items[checklistItemIndex];

        // Remove from current index
        const sourceChangedChecklistItems = Array.from(sourceChangedChecklist.items);
        sourceChangedChecklistItems.splice(checklistItemIndex, 1);

        // Add in new index
        const destinationChangedChecklistItems = Array.from(destinationChangedChecklist.items);
        destinationChangedChecklistItems.splice(newChecklistItemIndex, 0, itemToMove);

        sourceChangedChecklist.items = sourceChangedChecklistItems;
        destinationChangedChecklist.items = destinationChangedChecklistItems;

        newChecklist[checklistIndex] = sourceChangedChecklist;
        newChecklist[newChecklistIndex] = destinationChangedChecklist;

        onChange(newChecklist);
    };

    const onAddChecklist = () => {
        const checklist = emptyChecklist();
        checklist.title = 'New stage';
        const newChecklist = [...propChecklist, checklist];

        onChange(newChecklist);
    };

    const onChangeChecklist = (checklistIndex: number, checklist: Checklist) => {
        const newChecklist = [...propChecklist];
        newChecklist[checklistIndex] = checklist;

        onChange(newChecklist);
    };
    const onRemoveChecklist = (checklistIndex: number) => {
        const newChecklist = [...propChecklist];
        newChecklist.splice(checklistIndex, 1);

        onChange(newChecklist);
    };

    return (
        <div className='multi-checklist-editor'>
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable
                    droppableId='columns'
                    direction='vertical'
                    type='checklist'
                >
                    {(droppableProvided: DroppableProvided) => (
                        <div
                            ref={droppableProvided.innerRef}
                            {...droppableProvided.droppableProps}
                        >
                            {propChecklist?.map((checklist: Checklist, checklistIndex: number) => (
                                <div
                                    key={checklist.title + checklistIndex}
                                >
                                    <ChecklistEditor
                                        checklist={checklist}
                                        checklistIndex={checklistIndex}

                                        onChange={(newChecklist: Checklist) => {
                                            onChangeChecklist(checklistIndex, newChecklist);
                                        }}
                                        onRemove={() => {
                                            onRemoveChecklist(checklistIndex);
                                        }}
                                    />
                                </div>
                            ))}
                            {droppableProvided.placeholder}
                        </div>
                    )}
                </Droppable>

                <div className='new-stage'>
                    <a
                        href='#'
                        onClick={onAddChecklist}
                    >
                        <i className='icon icon-plus'/>
                        {'Add new stage'}
                    </a>
                </div>
            </DragDropContext>
        </div>
    );
};
