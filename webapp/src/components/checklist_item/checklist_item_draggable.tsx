// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Draggable, DraggableProvided, DraggableStateSnapshot} from 'react-beautiful-dnd';

import {setChecklistItemState} from 'src/client';
import {ButtonsFormat as ItemButtonsFormat, ChecklistItem} from 'src/components/checklist_item/checklist_item';
import {ChecklistItem as ChecklistItemType, ChecklistItemState} from 'src/types/playbook';
import {PlaybookRun} from 'src/types/playbook_run';

interface Props {
    playbookRun?: PlaybookRun;
    checklistIndex: number;
    item: ChecklistItemType;
    itemIndex: number;
    newItem: boolean;
    readOnly?: boolean;
    cancelAddingItem: () => void;
    onUpdateChecklistItem?: (newItem: ChecklistItemType) => void;
    onAddChecklistItem?: (newItem: ChecklistItemType) => void;
    onDuplicateChecklistItem?: () => void;
    onDeleteChecklistItem?: () => void;
    itemButtonsFormat?: ItemButtonsFormat;
    onViewerModeInteract?: () => void
}

const DraggableChecklistItem = (props: Props) => {
    const onChange = (newState: ChecklistItemState) => {
        if (props.readOnly) {
            props.onViewerModeInteract?.();
            return undefined;
        }
        return props.playbookRun && setChecklistItemState(props.playbookRun.id, props.checklistIndex, props.itemIndex, newState);
    };

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
                    channelId={props.playbookRun?.channel_id}
                    onChange={onChange}
                    draggableProvided={draggableProvided}
                    dragging={snapshot.isDragging || snapshot.combineWith != null}
                    readOnly={props.readOnly ?? false}
                    collapsibleDescription={true}
                    newItem={props.newItem}
                    cancelAddingItem={props.cancelAddingItem}
                    onUpdateChecklistItem={props.onUpdateChecklistItem}
                    onAddChecklistItem={props.onAddChecklistItem}
                    onDuplicateChecklistItem={props.onDuplicateChecklistItem}
                    onDeleteChecklistItem={props.onDeleteChecklistItem}
                    buttonsFormat={props.itemButtonsFormat}
                />
            )}
        </Draggable>
    );
};

export default DraggableChecklistItem;
