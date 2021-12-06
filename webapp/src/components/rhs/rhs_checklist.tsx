// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {Droppable, DroppableProvided} from 'react-beautiful-dnd';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {PlaybookRun} from 'src/types/playbook_run';
import {addNewTask} from 'src/actions';
import {
    Checklist,
    ChecklistItem,
    ChecklistItemsFilter,
    ChecklistItemState,
} from 'src/types/playbook';
import RHSChecklistItem from 'src/components/rhs/rhs_checklist_item';
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
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const checklistItemsFilter = useSelector(currentChecklistItemsFilter);
    const myUser = useSelector(getCurrentUser);

    const showItem = (checklistItem: ChecklistItem, filter: ChecklistItemsFilter, myId: string) => {
        if (filter.all) {
            return true;
        }
        if (!filter.checked && checklistItem.state === ChecklistItemState.Closed) {
            return false;
        }
        if (!filter.me && checklistItem.assignee_id === myId) {
            return false;
        }
        if (!filter.unassigned && checklistItem.assignee_id === '') {
            return false;
        }
        if (!filter.others && checklistItem.assignee_id !== myId) {
            return false;
        }
        return true;
    };

    const visibleTasks = (list: Checklist, filter: ChecklistItemsFilter, myId: string) => {
        return list.items.some((item) => showItem(item, filter, myId));
    };

    if (props.checklist.items.length === 0) {
        return (
            <EmptyChecklistContainer className='checklist'>
                <AddTaskLink
                    onClick={(e) => {
                        e.stopPropagation();
                        dispatch(addNewTask(props.checklistIndex));
                    }}
                >
                    {formatMessage({defaultMessage: '+ Add task'})}
                </AddTaskLink>
            </EmptyChecklistContainer>
        );
    }

    if (!visibleTasks(props.checklist, checklistItemsFilter, myUser.id)) {
        return null;
    }

    return (
        <Droppable
            droppableId='columns'
            direction='vertical'
            type='checklist'
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
                                <RHSChecklistItem
                                    key={checklistItem.title}
                                    playbookRun={props.playbookRun}
                                    checklistIndex={props.checklistIndex}
                                    item={checklistItem}
                                    itemIndex={index}
                                />
                            );
                        })}
                        {droppableProvided.placeholder}
                    </div>
                </ChecklistContainer>
            )}
        </Droppable>
    );
};

const ChecklistContainer = styled.div`
    background-color: var(--center-channel-bg);
    border-radius: 0 0 4px 4px;
    border:  1px solid rgba(var(--center-channel-color-rgb), 0.08);
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

export default RHSChecklist;
