// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {LockIcon} from '@mattermost/compass-icons/components';
import styled from 'styled-components';

import {getMyGroupIds} from 'mattermost-redux/selectors/entities/groups';
import {getGroupsByUserId} from 'mattermost-redux/actions/groups';

import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {useIsSystemAdmin} from 'src/hooks';
import Tooltip from 'src/components/widgets/tooltip';

interface Props {
    item: ChecklistItem;
    currentUserId: string;
    runOwnerId: string;
    runCreatorId: string;
    onChange: (state: ChecklistItemState) => void;
    readOnly: boolean;
    assigneeName?: string;
}

const TaskLockdownCheckbox = ({item, currentUserId, runOwnerId, runCreatorId, onChange, readOnly, assigneeName}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const isSystemAdmin = useIsSystemAdmin();
    const myGroupIds = useSelector(getMyGroupIds);

    useEffect(() => {
        if (item.assignee_type === 'group' && item.restrict_completion_to_assignee && currentUserId) {
            dispatch(getGroupsByUserId(currentUserId));
        }
    }, [currentUserId, dispatch, item.assignee_type, item.restrict_completion_to_assignee]);

    const hasAssignee = Boolean(
        item.assignee_id || item.assignee_group_id ||
        item.assignee_type === 'owner' || item.assignee_type === 'creator' ||
        item.assignee_type === 'property_user',
    );

    const isAssigneePermitted = useMemo((): boolean => {
        switch (item.assignee_type) {
        case 'owner':
            return currentUserId === runOwnerId;
        case 'creator':
            return currentUserId === runCreatorId;
        case 'group':
            return Boolean(item.assignee_group_id) && myGroupIds.includes(item.assignee_group_id!);
        case 'property_user':
            // Empty assignee_id means the property_user value hasn't been resolved yet;
            // fail-open so the task is not locked out before a value is set.
            return item.assignee_id === '' || currentUserId === item.assignee_id;
        default:
            return currentUserId === item.assignee_id;
        }
    }, [item.assignee_type, item.assignee_group_id, item.assignee_id, currentUserId, runOwnerId, runCreatorId, myGroupIds]);

    const isPermitted = !item.restrict_completion_to_assignee || isSystemAdmin || !hasAssignee || isAssigneePermitted;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isPermitted || readOnly) {
            return;
        }
        onChange(e.target.checked ? ChecklistItemState.Closed : ChecklistItemState.Open);
    }, [isPermitted, readOnly, onChange]);

    const checkbox = (
        <input
            type='checkbox'
            className='checkbox'
            data-testid='task-checkbox'
            checked={item.state === ChecklistItemState.Closed}
            disabled={!isPermitted || readOnly}
            onChange={handleChange}
        />
    );

    const tooltipContent = formatMessage(
        {id: 'playbooks.task_lockdown_checkbox.tooltip', defaultMessage: 'This task can only be completed by {name}'},
        {name: assigneeName || formatMessage({id: 'playbooks.task_lockdown_checkbox.assigned_user', defaultMessage: 'the assigned user'})},
    );

    return (
        <span>
            {item.restrict_completion_to_assignee && (
                <span
                    role='img'
                    aria-label={formatMessage(
                        {id: 'playbooks.task_lockdown_checkbox.aria_label', defaultMessage: 'Task restricted to {name}'},
                        {name: assigneeName || formatMessage({id: 'playbooks.task_lockdown_checkbox.assigned_user', defaultMessage: 'the assigned user'})},
                    )}
                    data-testid='lock-indicator'
                >
                    <LockIcon
                        size={14}
                        aria-hidden='true'
                    />
                </span>
            )}
            {isPermitted ? checkbox : (
                <Tooltip
                    id={`task-lockdown-tooltip-${item.id ?? item.title}`}
                    content={tooltipContent}
                >
                    <DisabledWrapper>
                        {checkbox}
                    </DisabledWrapper>
                </Tooltip>
            )}
        </span>
    );
};

const DisabledWrapper = styled.span`
    display: inline-block;
    cursor: not-allowed;
`;

export default TaskLockdownCheckbox;
