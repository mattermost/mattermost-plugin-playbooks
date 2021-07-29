// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {
    DragDropContext,
    Droppable,
    DroppableProvided,
    Draggable,
    DraggableProvided,
    DropResult,
    DraggableStateSnapshot,
} from 'react-beautiful-dnd';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {PlaybookRun} from 'src/types/playbook_run';
import {
    toggleRHS,
    playbookRunUpdated,
    setAllChecklistsCollapsedState,
    setChecklistCollapsedState,
} from 'src/actions';
import {ChecklistItem, ChecklistItemState, Checklist} from 'src/types/playbook';
import {setChecklistItemState, clientReorderChecklist} from 'src/client';
import {ChecklistItemDetails} from 'src/components/checklist_item';
import {isMobile} from 'src/mobile';
import CollapsibleChecklist from 'src/components/rhs/collapsible_checklist';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {currentChecklistAllCollapsed, currentChecklistCollapsedState} from 'src/selectors';

// disable all react-beautiful-dnd development warnings
// @ts-ignore
window['__react-beautiful-dnd-disable-dev-warnings'] = true;

interface Props {
    playbookRun: PlaybookRun;
}

const RHSChecklists = (props: Props) => {
    const dispatch = useDispatch();
    const channelId = useSelector(getCurrentChannelId);
    const checklistsState = useSelector(currentChecklistCollapsedState);
    const allCollapsed = useSelector(currentChecklistAllCollapsed);
    const [showMenu, setShowMenu] = useState(false);
    const checklists = props.playbookRun.checklists || [];

    return (
        <InnerContainer
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
        >
            {
                showMenu &&
                <HoverRow>
                    <HoverMenuButton
                        title={allCollapsed ? 'Expand' : 'Collapse'}
                        className={(allCollapsed ? 'icon-arrow-expand' : 'icon-arrow-collapse') + ' icon-16 btn-icon'}
                        onClick={() => dispatch(setAllChecklistsCollapsedState(channelId, !allCollapsed, checklists.length))}
                    />
                </HoverRow>
            }
            <MainTitle>{'Checklists'}</MainTitle>
            {checklists.map((checklist: Checklist, checklistIndex: number) => (
                <CollapsibleChecklist
                    key={checklist.title + checklistIndex}
                    title={checklist.title}
                    items={checklist.items}
                    index={checklistIndex}
                    collapsed={Boolean(checklistsState[checklistIndex])}
                    setCollapsed={(newState) => dispatch(setChecklistCollapsedState(channelId, checklistIndex, newState))}
                >
                    <ChecklistContainer className='checklist'>
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
                                newChecklists[checklistIndex] = {
                                    ...newChecklists[checklistIndex],
                                    items: newChecklistItems,
                                };

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
                    </ChecklistContainer>
                </CollapsibleChecklist>
            ))}
        </InnerContainer>
    );
};

const InnerContainer = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 12px 12px 24px 12px;

    &:hover {
        background-color: var(--center-channel-color-04);
    }
`;

const MainTitle = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    margin: 0 0 0 8px;
`;

const ChecklistContainer = styled.div`
    background-color: var(--center-channel-bg);
    padding: 16px 12px;
`;

const HoverRow = styled(HoverMenu)`
    top: 6px;
    right: 15px;
`;

export default RHSChecklists;
