// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import {Draggable, DraggableProvided, DraggableStateSnapshot} from 'react-beautiful-dnd';

import {toggleRHS} from 'src/actions';
import {setChecklistItemState} from 'src/client';
import {ChecklistItemDetails} from 'src/components/checklist_item';
import {isMobile} from 'src/mobile';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';

interface Props {
    playbookRun: PlaybookRun;
    checklistIndex: number;
    item: ChecklistItem;
    itemIndex: number;
}

const RHSChecklistItem = (props: Props) => {
    const dispatch = useDispatch();
    const finished = props.playbookRun.current_status === PlaybookRunStatus.Finished;

    return (
        <Draggable
            draggableId={props.item.title + props.itemIndex}
            index={props.itemIndex}
        >
            {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                <ChecklistItemDetails
                    checklistItem={props.item}
                    checklistNum={props.checklistIndex}
                    itemNum={props.itemIndex}
                    channelId={props.playbookRun.channel_id}
                    playbookRunId={props.playbookRun.id}
                    onChange={(newState: ChecklistItemState) => {
                        setChecklistItemState(props.playbookRun.id, props.checklistIndex, props.itemIndex, newState);
                    }}
                    onRedirect={() => {
                        if (isMobile()) {
                            dispatch(toggleRHS());
                        }
                    }}
                    draggableProvided={draggableProvided}
                    dragging={snapshot.isDragging}
                    disabled={finished}
                    collapsibleDescription={true}
                />
            )}
        </Draggable>
    );
};

export default RHSChecklistItem;
