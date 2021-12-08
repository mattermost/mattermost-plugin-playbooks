// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {
    DragDropContext,
    DropResult,
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
} from 'src/actions';
import {
    Checklist,
    ChecklistItem,
    ChecklistItemsFilter,
    ChecklistItemState,
} from 'src/types/playbook';
import {
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

// disable all react-beautiful-dnd development warnings
// @ts-ignore
window['__react-beautiful-dnd-disable-dev-warnings'] = true;

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

    return (
        <InnerContainer
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
            <DragDropContext
                onDragEnd={(result: DropResult) => {
                    if (!result.destination) {
                        return;
                    }

                    if (result.destination.droppableId === result.source.droppableId &&
                        result.destination.index === result.source.index) {
                        return;
                    }

                    const sourceChecklistIdx = parseInt(result.source.droppableId, 10);
                    const destChecklistIdx = parseInt(result.destination.droppableId, 10);
                    const newChecklists = Array.from(checklists);

                    if (sourceChecklistIdx === destChecklistIdx) {
                        // Remove the dragged item from the checklist
                        const newChecklistItems = Array.from(checklists[sourceChecklistIdx].items);
                        const [removed] = newChecklistItems.splice(result.source.index, 1);

                        // Add the dragged item to the checklist
                        newChecklistItems.splice(result.destination.index, 0, removed);
                        newChecklists[sourceChecklistIdx] = {
                            ...newChecklists[sourceChecklistIdx],
                            items: newChecklistItems,
                        };
                    } else {
                        const sourceChecklist = checklists[sourceChecklistIdx];
                        const destChecklist = checklists[destChecklistIdx];

                        // Remove the dragged item from the source checklist
                        const newSourceChecklistItems = Array.from(sourceChecklist.items);
                        const [moved] = newSourceChecklistItems.splice(result.source.index, 1);

                        // Add the dragged item to the destination checklist
                        const newDestChecklistItems = Array.from(destChecklist.items);
                        newDestChecklistItems.splice(result.destination.index, 0, moved);

                        // Modify the new checklists array with the new source and destination checklists
                        newChecklists[sourceChecklistIdx] = {
                            ...sourceChecklist,
                            items: newSourceChecklistItems,
                        };
                        newChecklists[destChecklistIdx] = {
                            ...destChecklist,
                            items: newDestChecklistItems,
                        };
                    }

                    dispatch(playbookRunUpdated({
                        ...props.playbookRun,
                        checklists: newChecklists,
                    }));

                    clientMoveChecklistItem(props.playbookRun.id, sourceChecklistIdx, result.source.index, destChecklistIdx, result.destination.index);
                }}
            >
                {checklists.map((checklist: Checklist, checklistIndex: number) => (
                    <CollapsibleChecklist
                        key={checklist.title}
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
                ))}
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

const ChecklistContainer = styled.div`
    background-color: var(--center-channel-bg);
    border-radius: 0 0 4px 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-top: 0;
    padding: 16px 12px;
`;

const EmptyChecklistContainer = styled(ChecklistContainer)`
    padding: 12px;
`;

const AddTaskLink = styled.button`
    font-size: 12px;
    font-weight: 600;

    color: var(--button-bg);

    background: none;
    border: none;
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
            if (item.state !== ChecklistItemState.Closed) {
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

const showItem = (checklistItem: ChecklistItem, filter: ChecklistItemsFilter, myId: string) => {
    if (filter.all) {
        return true;
    }

    // "Show checked tasks" is not checked, so if item is checked (closed), don't show it.
    if (!filter.checked && checklistItem.state === ChecklistItemState.Closed) {
        return false;
    }

    // "Me" is not checked, so if assignee_id is me, don't show it.
    if (!filter.me && checklistItem.assignee_id === myId) {
        return false;
    }

    // "Unassigned" is not checked, so if assignee_id is blank (unassigned), don't show it.
    if (!filter.unassigned && checklistItem.assignee_id === '') {
        return false;
    }

    // "Others" is not checked, so if item has someone else as the assignee, don't show it.
    if (!filter.others && checklistItem.assignee_id !== '' && checklistItem.assignee_id !== myId) {
        return false;
    }

    // We should show it!
    return true;
};

const visibleTasks = (list: Checklist, filter: ChecklistItemsFilter, myId: string) => {
    return list.items.some((item) => showItem(item, filter, myId));
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
