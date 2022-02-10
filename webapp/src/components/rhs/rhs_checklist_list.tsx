// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {
    DragDropContext,
    DropResult,
    Droppable,
    DroppableProvided,
    Draggable,
    DraggableProvided,
    DraggableStateSnapshot,
} from 'react-beautiful-dnd';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {
    finishRun,
    playbookRunUpdated,
    setAllChecklistsCollapsedState,
    setChecklistCollapsedState,
    setChecklistItemsFilter,
    setEachChecklistCollapsedState,
} from 'src/actions';
import {
    Checklist,
    ChecklistItemsFilter,
    ChecklistItemState,
} from 'src/types/playbook';
import {
    clientMoveChecklist,
    clientMoveChecklistItem,
    telemetryEventForPlaybookRun,
} from 'src/client';
import CollapsibleChecklist from 'src/components/collapsible_checklist';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {
    currentChecklistAllCollapsed,
    currentChecklistCollapsedState,
    currentChecklistItemsFilter,
} from 'src/selectors';
import MultiCheckbox, {CheckboxOption} from 'src/components/multi_checkbox';
import {DotMenuButton} from 'src/components/dot_menu';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {SemiBoldHeading} from 'src/styles/headings';
import AddChecklistDialog from 'src/components/rhs/rhs_checklists_add_dialog';
import RHSChecklist from 'src/components/rhs/rhs_checklist';
import TutorialTourTip, {useMeasurePunchouts, useShowTutorialStep} from 'src/components/tutorial/tutorial_tour_tip';
import {RunDetailsTutorialSteps, TutorialTourCategories} from 'src/components/tutorial/tours';

// disable all react-beautiful-dnd development warnings
// @ts-ignore
window['__react-beautiful-dnd-disable-dev-warnings'] = true;

// Create a portal for the checklist to render while dragging
const portal: HTMLElement = document.createElement('div');
document.body.appendChild(portal);

interface Props {
    playbookRun: PlaybookRun;
}

const RHSChecklistList = (props: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const channelId = useSelector(getCurrentChannelId);
    const checklistsState = useSelector(currentChecklistCollapsedState);
    const allCollapsed = useSelector(currentChecklistAllCollapsed);
    const checklistItemsFilter = useSelector(currentChecklistItemsFilter);
    const myUser = useSelector(getCurrentUser);
    const teamnameNameDisplaySetting = useSelector(getTeammateNameDisplaySetting) || '';
    const preferredName = displayUsername(myUser, teamnameNameDisplaySetting);
    const [showMenu, setShowMenu] = useState(false);
    const [showAddChecklistDialog, setShowAddChecklistDialog] = useState(false);
    const checklistsPunchout = useMeasurePunchouts(
        ['pb-checklists-inner-container'],
        [],
        {y: -5, height: 10, x: -5, width: 10},
    );
    const showRunDetailsChecklistsStep = useShowTutorialStep(
        RunDetailsTutorialSteps.Checklists,
        TutorialTourCategories.RUN_DETAILS
    );

    const checklists = props.playbookRun.checklists || [];
    const FinishButton = allComplete(props.playbookRun.checklists) ? StyledPrimaryButton : StyledTertiaryButton;
    const active = props.playbookRun.current_status === PlaybookRunStatus.InProgress;
    const finished = props.playbookRun.current_status === PlaybookRunStatus.Finished;
    const filterOptions = makeFilterOptions(checklistItemsFilter, preferredName);

    const selectOption = (value: string, checked: boolean) => {
        telemetryEventForPlaybookRun(props.playbookRun.id, 'checklists_filter_selected');

        if (checklistItemsFilter.all && value !== 'all') {
            return;
        }
        if (isLastCheckedValueInBottomCategory(value, checked, checklistItemsFilter)) {
            return;
        }

        dispatch(setChecklistItemsFilter(channelId, {
            ...checklistItemsFilter,
            [value]: checked,
        }));
    };

    const onDragEnd = (result: DropResult) => {
        // If the item is dropped out of any droppable zones, do nothing
        if (!result.destination) {
            return;
        }

        const [srcIdx, dstIdx] = [result.source.index, result.destination.index];

        // If the source and desination are the same, do nothing
        if (result.destination.droppableId === result.source.droppableId && srcIdx === dstIdx) {
            return;
        }

        // Copy the data to modify it
        const newChecklists = Array.from(checklists);

        // Move a checklist item, either inside of the same checklist, or between checklists
        if (result.type === 'checklist-item') {
            const srcChecklistIdx = parseInt(result.source.droppableId, 10);
            const dstChecklistIdx = parseInt(result.destination.droppableId, 10);

            if (srcChecklistIdx === dstChecklistIdx) {
                // Remove the dragged item from the checklist
                const newChecklistItems = Array.from(checklists[srcChecklistIdx].items);
                const [removed] = newChecklistItems.splice(srcIdx, 1);

                // Add the dragged item to the checklist
                newChecklistItems.splice(dstIdx, 0, removed);
                newChecklists[srcChecklistIdx] = {
                    ...newChecklists[srcChecklistIdx],
                    items: newChecklistItems,
                };
            } else {
                const srcChecklist = checklists[srcChecklistIdx];
                const dstChecklist = checklists[dstChecklistIdx];

                // Remove the dragged item from the source checklist
                const newSrcChecklistItems = Array.from(srcChecklist.items);
                const [moved] = newSrcChecklistItems.splice(srcIdx, 1);

                // Add the dragged item to the destination checklist
                const newDstChecklistItems = Array.from(dstChecklist.items);
                newDstChecklistItems.splice(dstIdx, 0, moved);

                // Modify the new checklists array with the new source and destination checklists
                newChecklists[srcChecklistIdx] = {
                    ...srcChecklist,
                    items: newSrcChecklistItems,
                };
                newChecklists[dstChecklistIdx] = {
                    ...dstChecklist,
                    items: newDstChecklistItems,
                };
            }

            // Persist the new data in the server
            clientMoveChecklistItem(props.playbookRun.id, srcChecklistIdx, srcIdx, dstChecklistIdx, dstIdx);
        }

        // Move a whole checklist
        if (result.type === 'checklist') {
            const [moved] = newChecklists.splice(srcIdx, 1);
            newChecklists.splice(dstIdx, 0, moved);

            // The collapsed state of a checklist in the store is linked to the index in the list,
            // so we need to shift all indices between srcIdx and dstIdx to the left (or to the
            // right, depending on whether srcIdx < dstIdx) one position
            const newState = {...checklistsState};
            if (srcIdx < dstIdx) {
                for (let i = srcIdx; i < dstIdx; i++) {
                    newState[i] = checklistsState[i + 1];
                }
            } else {
                for (let i = dstIdx + 1; i <= srcIdx; i++) {
                    newState[i] = checklistsState[i - 1];
                }
            }
            newState[dstIdx] = checklistsState[srcIdx];
            dispatch(setEachChecklistCollapsedState(channelId, newState));

            // Persist the new data in the server
            clientMoveChecklist(props.playbookRun.id, srcIdx, dstIdx);
        }

        // Update the store with the new checklists
        dispatch(playbookRunUpdated({
            ...props.playbookRun,
            checklists: newChecklists,
        }));
    };

    return (
        <InnerContainer
            id='pb-checklists-inner-container'
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
        >
            <MainTitleBG numChecklists={checklists.length}>
                <MainTitle>
                    {formatMessage({defaultMessage: 'Checklists'})}
                    {
                        showMenu &&
                        <HoverRow>
                            <ExpandHoverButton
                                title={allCollapsed ? formatMessage({defaultMessage: 'Expand'}) : formatMessage({defaultMessage: 'Collapse'})}
                                className={(allCollapsed ? 'icon-arrow-expand' : 'icon-arrow-collapse') + ' icon-16 btn-icon'}
                                onClick={() => dispatch(setAllChecklistsCollapsedState(channelId, !allCollapsed, checklists.length))}
                            />
                            <HoverMenuButton
                                title={formatMessage({defaultMessage: 'Add checklist'})}
                                className={'icon-plus icon-16 btn-icon'}
                                onClick={() => setShowAddChecklistDialog(true)}
                            />
                            <MultiCheckbox
                                options={filterOptions}
                                onselect={selectOption}
                                dotMenuButton={StyledDotMenuButton}
                                icon={
                                    <IconWrapper>
                                        <i className='icon icon-filter-variant'/>
                                    </IconWrapper>
                                }
                            />
                        </HoverRow>
                    }
                </MainTitle>
            </MainTitleBG>
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable
                    droppableId={'all-checklists'}
                    direction={'vertical'}
                    type={'checklist'}
                >
                    {(droppableProvided: DroppableProvided) => (
                        <ChecklistsContainer
                            {...droppableProvided.droppableProps}
                            ref={droppableProvided.innerRef}
                        >
                            {checklists.map((checklist: Checklist, checklistIndex: number) => (
                                <Draggable
                                    key={checklist.title}
                                    draggableId={checklist.title + checklistIndex}
                                    index={checklistIndex}
                                >
                                    {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
                                        const component = (
                                            <CollapsibleChecklist
                                                draggableProvided={draggableProvided}
                                                title={checklist.title}
                                                items={checklist.items}
                                                index={checklistIndex}
                                                numChecklists={checklists.length}
                                                collapsed={Boolean(checklistsState[checklistIndex])}
                                                setCollapsed={(newState) => dispatch(setChecklistCollapsedState(channelId, checklistIndex, newState))}
                                                disabledOrRunID={finished || props.playbookRun.id}
                                            >
                                                <RHSChecklist
                                                    playbookRun={props.playbookRun}
                                                    checklist={checklist}
                                                    checklistIndex={checklistIndex}
                                                />
                                            </CollapsibleChecklist>
                                        );

                                        if (snapshot.isDragging) {
                                            return ReactDOM.createPortal(component, portal);
                                        }

                                        return component;
                                    }}
                                </Draggable>
                            ))}
                            {droppableProvided.placeholder}
                        </ChecklistsContainer>
                    )}
                </Droppable>
            </DragDropContext>
            {
                active &&
                <FinishButton onClick={() => dispatch(finishRun(props.playbookRun.team_id))}>
                    {formatMessage({defaultMessage: 'Finish run'})}
                </FinishButton>
            }
            <AddChecklistDialog
                playbookRunID={props.playbookRun.id}
                show={showAddChecklistDialog}
                onHide={() => setShowAddChecklistDialog(false)}
            />
            {showRunDetailsChecklistsStep && (
                <TutorialTourTip
                    title={<FormattedMessage defaultMessage='Track progress and ownership'/>}
                    screen={<FormattedMessage defaultMessage='Assign, check off, or skip tasks to ensure the team is clear on how to move toward the finish line together.'/>}
                    tutorialCategory={TutorialTourCategories.RUN_DETAILS}
                    step={RunDetailsTutorialSteps.Checklists}
                    showOptOut={false}
                    placement='left'
                    pulsatingDotPlacement='top-start'
                    pulsatingDotTranslate={{x: 0, y: 0}}
                    width={352}
                    autoTour={true}
                    punchOut={checklistsPunchout}
                />
            )}
        </InnerContainer>
    );
};

const InnerContainer = styled.div`
    position: relative;
    z-index: 1;

    display: flex;
    flex-direction: column;
    padding: 0 12px 24px 12px;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04);
    }
    .pb-tutorial-tour-tip__pulsating-dot-ctr {
        z-index: 1000;
    }
`;

const MainTitleBG = styled.div<{ numChecklists: number }>`
    background-color: var(--center-channel-bg);
    z-index: ${({numChecklists}) => numChecklists + 2};
    position: sticky;
    top: 0;
`;

const MainTitle = styled.div`
    ${SemiBoldHeading} {
    }

    ${InnerContainer}:hover & {
        background-color: rgba(var(--center-channel-color-rgb), .04);
    }

    font-size: 16px;
    line-height: 24px;
    padding: 12px 0 12px 8px;
`;

const ChecklistsContainer = styled.div`
`;

const HoverRow = styled(HoverMenu)`
    top: 6px;
    right: 15px;
`;

const ExpandHoverButton = styled(HoverMenuButton)`
    padding: 3px 0 0 1px;
`;

const StyledDotMenuButton = styled(DotMenuButton)`
    display: inline-block;
    width: 28px;
    height: 28px;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }
`;

const IconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

const StyledTertiaryButton = styled(TertiaryButton)`
    display: inline-block;
    margin: 12px 0;
`;

const StyledPrimaryButton = styled(PrimaryButton)`
    display: inline-block;
    margin: 12px 0;
`;

export default RHSChecklistList;

const allComplete = (checklists: Checklist[]) => {
    return outstandingTasks(checklists) === 0;
};

const outstandingTasks = (checklists: Checklist[]) => {
    let count = 0;
    for (const list of checklists) {
        for (const item of list.items) {
            if (item.state === ChecklistItemState.Open || item.state === ChecklistItemState.InProgress) {
                count++;
            }
        }
    }
    return count;
};

const makeFilterOptions = (filter: ChecklistItemsFilter, name: string): CheckboxOption[] => {
    return [
        {
            display: 'All tasks',
            value: 'all',
            selected: filter.all,
            disabled: false,
        },
        {
            value: 'divider',
            display: '',
        },
        {
            value: 'title',
            display: 'TASK STATE',
        },
        {
            display: 'Show checked tasks',
            value: 'checked',
            selected: filter.checked,
            disabled: filter.all,
        },
        {
            value: 'divider',
            display: '',
        },
        {
            value: 'title',
            display: 'ASSIGNEE',
        },
        {
            display: `Me (${name})`,
            value: 'me',
            selected: filter.me,
            disabled: filter.all,
        },
        {
            display: 'Unassigned',
            value: 'unassigned',
            selected: filter.unassigned,
            disabled: filter.all,
        },
        {
            display: 'Others',
            value: 'others',
            selected: filter.others,
            disabled: filter.all,
        },
    ];
};

// isLastCheckedValueInBottomCategory returns true only if this value is in the bottom category and
// it is the last checked value. We don't want to allow the user to deselect all the options in
// the bottom category.
const isLastCheckedValueInBottomCategory = (value: string, nextState: boolean, filter: ChecklistItemsFilter) => {
    const inBottomCategory = (val: string) => val === 'me' || val === 'unassigned' || val === 'others';
    if (!inBottomCategory(value)) {
        return false;
    }
    const numChecked = ['me', 'unassigned', 'others'].reduce((accum, cur) => (
        (inBottomCategory(cur) && filter[cur]) ? accum + 1 : accum
    ), 0);
    return numChecked === 1 && filter[value];
};
