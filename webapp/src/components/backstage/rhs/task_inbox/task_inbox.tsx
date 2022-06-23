import React, {useEffect, useState} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import Icon from '@mdi/react';
import {mdiCircleSmall} from '@mdi/js';
import {DateTime} from 'luxon';

import DotMenu, {DropdownMenu, DotMenuButton, DropdownMenuItem} from 'src/components/dot_menu';

import {fetchPlaybookRuns} from 'src/client';
import {PlaybookRunStatus, PlaybookRunChecklistItem} from 'src/types/playbook_run';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {selectMyTasks} from 'src/selectors';
import {receivedPlaybookRuns} from 'src/actions';

import Task from './task';

export const TaskInboxTitle = <FormattedMessage defaultMessage={'Your tasks'}/>;

enum Filter {
    FilterChecked = 'checked',
    FilterRunOwner = 'ownrun',
}

const filterTasks = (checklistItems: PlaybookRunChecklistItem[], userId: string, filters: Filter[]) => {
    return checklistItems
        .filter((item) => {
            if (item.assignee_id !== userId && !filters.includes(Filter.FilterRunOwner)) {
                return false;
            }
            if (item.state !== ChecklistItemState.Open && !filters.includes(Filter.FilterChecked)) {
                return false;
            }
            if (item.assignee_id === '' && item.playbook_run_owner_user_id !== userId && filters.includes(Filter.FilterRunOwner)) {
                return false;
            }

            return true;
        })
        .sort((a, b) => {
            if (a.due_date !== 0 && b.due_date === 0) {
                return -1;
            }
            if (a.due_date === 0 && b.due_date !== 0) {
                return 1;
            }
            if (a.due_date !== 0 && b.due_date !== 0) {
                return -1 * (b.due_date - a.due_date);
            }
            return -1 * (b.playbook_run_create_at - a.playbook_run_create_at);
        });
};

const isOverdue = (item: ChecklistItem) => {
    if (item.due_date === 0 || DateTime.fromMillis(item.due_date) > DateTime.now()) {
        return false;
    }

    if (item.state === ChecklistItemState.Closed || item.state === ChecklistItemState.Skip) {
        return false;
    }
    return true;
};

const TaskInbox = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [filters, setFilters] = useState<Filter[]>([]);
    const currentUserId = useSelector(getCurrentUserId);
    const myTasks = useSelector(selectMyTasks);

    useEffect(() => {
        const options = {
            page: 0,
            per_page: 50,
            statuses: [PlaybookRunStatus.InProgress],
            participant_id: currentUserId,
        };
        fetchPlaybookRuns(options)
            .then((res) => dispatch(receivedPlaybookRuns(res.items || [])));
    }, [currentUserId]);

    const toggleFilter = (f: Filter) => {
        if (filters.includes(f)) {
            setFilters([...filters.filter((e) => e !== f)]);
        } else {
            setFilters([...filters, f]);
        }
    };

    const tasks = filterTasks(myTasks, currentUserId, filters);
    const assignedNum = tasks.filter((item) => item.assignee_id === currentUserId).length;
    const overdueNum = tasks.filter((item) => isOverdue(item)).length;

    return (
        <Container>
            <Filters>
                <FilterAssignedText>
                    {formatMessage({defaultMessage: '{assignedNum, plural, =0 {No assigned tasks} other {# assigned}}'}, {assignedNum})}
                </FilterAssignedText>
                <Icon
                    path={mdiCircleSmall}
                    size={1}
                />
                <FilterOverdueText>
                    {formatMessage({defaultMessage: '{overdueNum, plural, =0 {} other {# overdue}}'}, {overdueNum})}
                </FilterOverdueText>
                <ExpandRight/>
                <DotMenu
                    icon={<FilterWrapper>{formatMessage({defaultMessage: 'Filters'})}</FilterWrapper>}
                    dotMenuButton={FilterButton}
                    dropdownMenu={StyledDropdownMenu}
                    placement='bottom-end'
                    title={formatMessage({defaultMessage: 'More'})}
                >
                    <StyledDropdownMenuItem
                        onClick={() => toggleFilter(Filter.FilterRunOwner)}
                        checked={filters.includes(Filter.FilterRunOwner)}
                    >
                        {formatMessage({defaultMessage: 'Show all tasks from runs I own'})}
                    </StyledDropdownMenuItem>
                    <StyledDropdownMenuItem
                        onClick={() => toggleFilter(Filter.FilterChecked)}
                        checked={filters.includes(Filter.FilterChecked)}
                    >
                        {formatMessage({defaultMessage: 'Show checked tasks'})}
                    </StyledDropdownMenuItem>
                </DotMenu>
            </Filters>
            <TaskList>
                {tasks.map((task) => (
                    <Task
                        key={`${task.id}`}
                        item={task}
                    />
                ))}
            </TaskList>
        </Container>
    );
};

export default TaskInbox;

const Container = styled.div`
    margin-bottom: 30px;
`;

const Filters = styled.div`
    flex: 1;
    height: 56px;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0 10px;
    background-color: rgba(var(--center-channel-color-rgb),0.04);
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const FilterAssignedText = styled.div`
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    margin: 0 5px;
`;
const FilterOverdueText = styled(FilterAssignedText)`
    color: var(--dnd-indicator);
`;

const FilterWrapper = styled.div``;

const FilterButton = styled(DotMenuButton)`
    color: var(--button-bg);
    height: 20px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0 10px;
    border: 0;
    width: auto;

    &:before {
        color: var(--button-bg);
        content: '\f0236';
        font-size: 12px;
        font-family: 'compass-icons', mattermosticons;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        margin-right: 3px;
    }

    :hover {
        background-color: rgba(var(--button-bg-rgb),0.08);
    }
`;

const TaskList = styled.div`
    display: flex;
    flex-direction: column;
`;

export const ExpandRight = styled.div`
    margin-left: auto;
`;

export const StyledDropdownMenu = styled(DropdownMenu)`
    padding: 8px 0;
`;

export const StyledDropdownMenuItem = styled(DropdownMenuItem)<{checked: boolean}>`
    padding: 8px 0;
    font-size: 14px;

    &:after {
        display: ${({checked}) => (checked ? 'block' : 'none')};
        color: var(--button-bg);
        content: '\f012c';
        font-size: 14px;
        font-family: 'compass-icons', mattermosticons;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        margin-left: 3px;
    }
`;
