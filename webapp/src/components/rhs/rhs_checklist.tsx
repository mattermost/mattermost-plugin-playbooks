// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import {Droppable, DroppableProvided} from 'react-beautiful-dnd';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {DateTime} from 'luxon';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {
    Checklist,
    ChecklistItem,
    ChecklistItemsFilter,
    ChecklistItemState,
    emptyChecklistItem,
} from 'src/types/playbook';
import DraggableChecklistItem from 'src/components/checklist_item/checklist_item_draggable';
import {currentChecklistItemsFilter} from 'src/selectors';

// disable all react-beautiful-dnd development warnings
// @ts-ignore
window['__react-beautiful-dnd-disable-dev-warnings'] = true;

interface Props {
    playbookRun: PlaybookRun;
    checklist: Checklist;
    checklistIndex: number;
}

const RHSChecklist = (props: Props) => {
    const {formatMessage} = useIntl();
    const checklistItemsFilter = useSelector(currentChecklistItemsFilter);
    const myUser = useSelector(getCurrentUser);
    const [addingItem, setAddingItem] = useState(false);

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

        // "Overdue" is checked, so if item is not overdue or due date is not set, don't show it.
        if (filter.overdueOnly && (checklistItem.due_date === 0 || DateTime.fromMillis(checklistItem.due_date) > DateTime.now())) {
            return false;
        }

        // We should show it!
        return true;
    };

    return (
        <Droppable
            droppableId={props.checklistIndex.toString()}
            direction='vertical'
            type='checklist-item'
        >
            {(droppableProvided: DroppableProvided) => (
                <ChecklistContainer className='checklist'>
                    <div
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                    >
                        {props.checklist.items.map((checklistItem: ChecklistItem, index: number) => {
                            // filtering here because we need to maintain the index values
                            // because we refer to checklist items by their index
                            if (!showItem(checklistItem, checklistItemsFilter, myUser.id)) {
                                return null;
                            }

                            return (
                                <DraggableChecklistItem
                                    key={checklistItem.title}
                                    playbookRun={props.playbookRun}
                                    checklistIndex={props.checklistIndex}
                                    item={checklistItem}
                                    itemIndex={index}
                                    newItem={false}
                                    cancelAddingItem={() => {
                                        setAddingItem(false);
                                    }}
                                />
                            );
                        })}
                        {addingItem &&
                            <DraggableChecklistItem
                                key={'new_checklist_item'}
                                playbookRun={props.playbookRun}
                                checklistIndex={props.checklistIndex}
                                item={emptyChecklistItem()}
                                itemIndex={-1}
                                newItem={true}
                                cancelAddingItem={() => {
                                    setAddingItem(false);
                                }}
                            />
                        }
                        {droppableProvided.placeholder}
                    </div>
                    {props.playbookRun.current_status !== PlaybookRunStatus.Finished &&
                        <AddTaskLink
                            onClick={() => {
                                setAddingItem(true);
                            }}
                        >
                            <IconWrapper>
                                <i className='icon icon-plus'/>
                            </IconWrapper>
                            {formatMessage({defaultMessage: 'Add a task'})}
                        </AddTaskLink>
                    }
                </ChecklistContainer>
            )}
        </Droppable>
    );
};

const IconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

const ChecklistContainer = styled.div`
    background-color: var(--center-channel-bg);
    border-radius: 0 0 4px 4px;
    border:  1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-top: 0;
    padding: 16px 0px;
`;

const AddTaskLink = styled.button`
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    height: 44px;
    width: 100%;

    background: none;
    border: none;

    border-radius: 8px;
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;

    color: var(--center-channel-color-64);

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04);
        color: var(--button-bg);
    }
`;

export default RHSChecklist;
