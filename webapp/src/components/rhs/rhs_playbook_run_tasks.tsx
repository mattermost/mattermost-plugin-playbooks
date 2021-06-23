// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import Scrollbars from 'react-custom-scrollbars';

import {DragDropContext, Droppable, DroppableProvided, Draggable, DraggableProvided, DropResult, DraggableStateSnapshot} from 'react-beautiful-dnd';

import {PlaybookRun} from 'src/types/playbook_run';

import {toggleRHS, addNewTask, playbookRunUpdated} from 'src/actions';
import {ChecklistItem, ChecklistItemState, Checklist} from 'src/types/playbook';
import {setChecklistItemState, clientReorderChecklist} from 'src/client';
import {ChecklistItemDetails} from 'src/components/checklist_item';
import {isMobile} from 'src/mobile';
import {
    renderThumbHorizontal,
    renderThumbVertical,
    renderView,
} from 'src/components/rhs/rhs_shared';

const Title = styled.div`
   font-weight: 600;
   font-size: 14px;
`;

const TitleLine = styled.div`
    padding: 24px 0 8px;
    display: flex;
    justify-content: space-between;
`;

const AddNewTask = styled.button`
    background: transparent;
    display: inline-flex;
    align-items: center;
    color: var(--button-bg);
    font-weight: 600;
    font-size: 12px;
    line-height: 9px;
    border-radius: 4px;
    border: 0px;

    transition: all 0.15s ease-out;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.16);
    }
`;

const InnerContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 0 0 24px 0;
`;

interface Props {
    playbookRun: PlaybookRun;
}

const RHSPlaybookRunTasks = (props: Props) => {
    const dispatch = useDispatch();

    const checklists = props.playbookRun.checklists || [];

    return (
        <Scrollbars
            autoHide={true}
            autoHideTimeout={500}
            autoHideDuration={500}
            renderThumbHorizontal={renderThumbHorizontal}
            renderThumbVertical={renderThumbVertical}
            renderView={renderView}
            style={{position: 'absolute'}}
        >
            <div className='PlaybookRunDetails'>
                <InnerContainer>
                    {checklists.map((checklist: Checklist, checklistIndex: number) => (
                        <>
                            <TitleLine>
                                <Title>
                                    {checklist.title}
                                </Title>
                                <AddNewTask
                                    onClick={() => {
                                        dispatch(addNewTask(checklistIndex));
                                    }}
                                >
                                    <i className='icon-plus'/>
                                    {'Add new task'}
                                </AddNewTask>
                            </TitleLine>
                            <div className='checklist'>
                                <DragDropContext
                                    onDragEnd={(result: DropResult) => {
                                        if (!result.destination) {
                                            return;
                                        }

                                        if (result.destination.droppableId === result.source.droppableId &&
                                            result.destination.index === result.source.index) {
                                            return;
                                        }

                                        const newChecklists = Array.from(checklists);
                                        const newChecklistItems = Array.from(checklists[checklistIndex].items);
                                        const [removed] = newChecklistItems.splice(result.source.index, 1);
                                        newChecklistItems.splice(result.destination.index, 0, removed);
                                        newChecklists[checklistIndex] = {...newChecklists[checklistIndex], items: newChecklistItems};

                                        dispatch(playbookRunUpdated({
                                            ...props.playbookRun,
                                            checklists: newChecklists,
                                        }));

                                        clientReorderChecklist(props.playbookRun.id, checklistIndex, result.source.index, result.destination.index);
                                    }}
                                >
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
                                                {checklist.items.map((checklistItem: ChecklistItem, index: number) => (
                                                    <Draggable
                                                        key={checklistItem.title + index}
                                                        draggableId={checklistItem.title + index}
                                                        index={index}
                                                    >
                                                        {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                            <ChecklistItemDetails
                                                                checklistItem={checklistItem}
                                                                checklistNum={checklistIndex}
                                                                itemNum={index}
                                                                channelId={props.playbookRun.channel_id}
                                                                playbookRunId={props.playbookRun.id}
                                                                onChange={(newState: ChecklistItemState) => {
                                                                    setChecklistItemState(props.playbookRun.id, checklistIndex, index, newState);
                                                                }}
                                                                onRedirect={() => {
                                                                    if (isMobile()) {
                                                                        dispatch(toggleRHS());
                                                                    }
                                                                }}
                                                                draggableProvided={draggableProvided}
                                                                dragging={snapshot.isDragging}
                                                            />
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {droppableProvided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            </div>
                        </>
                    ))}
                </InnerContainer>
            </div>
        </Scrollbars>
    );
};

export default RHSPlaybookRunTasks;
