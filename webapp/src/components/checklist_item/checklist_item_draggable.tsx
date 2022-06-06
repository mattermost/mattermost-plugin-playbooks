// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Draggable, DraggableProvided, DraggableStateSnapshot} from 'react-beautiful-dnd';

import {setChecklistItemState} from 'src/client';
import {ChecklistItem} from 'src/components/checklist_item/checklist_item';
import {ChecklistItem as ChecklistItemType, ChecklistItemState} from 'src/types/playbook';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';

interface Props {
    playbookRun?: PlaybookRun;
    checklistIndex: number;
    item: ChecklistItemType;
    itemIndex: number;
    newItem: boolean;
    menuEnabled: boolean;
    disabled?: boolean;
    cancelAddingItem: () => void;
    onUpdateChecklistItem?: (newItem: ChecklistItemType) => void;
    onAddChecklistItem?: (newItem: ChecklistItemType) => void;
    onDuplicateChecklistItem?: () => void;
    onDeleteChecklistItem?: () => void;
}

const DraggableChecklistItem = (props: Props) => {
    const finished = props.playbookRun?.current_status === PlaybookRunStatus.Finished;

    return (
        <Draggable
            draggableId={props.item.title + props.itemIndex}
            index={props.itemIndex}
        >
            {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                <ChecklistItem
                    checklistItem={props.item}
                    checklistNum={props.checklistIndex}
                    itemNum={props.itemIndex}
                    playbookRunId={props.playbookRun?.id}
                    onChange={(newState: ChecklistItemState) => props.playbookRun && setChecklistItemState(props.playbookRun.id, props.checklistIndex, props.itemIndex, newState)}
                    draggableProvided={draggableProvided}
                    dragging={snapshot.isDragging}
                    disabled={props.disabled || finished}
                    menuEnabled={props.menuEnabled}
                    collapsibleDescription={true}
                    newItem={props.newItem}
                    cancelAddingItem={props.cancelAddingItem}
                    onUpdateChecklistItem={props.onUpdateChecklistItem}
                    onAddChecklistItem={props.onAddChecklistItem}
                    onDuplicateChecklistItem={props.onDuplicateChecklistItem}
                    onDeleteChecklistItem={props.onDeleteChecklistItem}
                />
            )}
        </Draggable>
    );
};

export default DraggableChecklistItem;
