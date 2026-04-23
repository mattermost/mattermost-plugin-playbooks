// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import LockIcon from '@mattermost/compass-icons/components/lock';
import LockOpenIcon from '@mattermost/compass-icons/components/lock-outline';

import {ChecklistItem} from 'src/types/playbook';

interface Props {
    item: ChecklistItem;
    onChange: (item: ChecklistItem) => void;
}

const TaskLockdownIcon = ({item, onChange}: Props) => {
    const {formatMessage} = useIntl();
    const handleClick = useCallback(() => {
        onChange({
            ...item,
            restrict_completion_to_assignee: !item.restrict_completion_to_assignee,
        });
    }, [item, onChange]);

    const LockComponent = item.restrict_completion_to_assignee ? LockIcon : LockOpenIcon;

    return (
        <span
            role='button'
            tabIndex={0}
            data-testid='lock-icon'
            data-locked={item.restrict_completion_to_assignee}
            aria-label={item.restrict_completion_to_assignee ? formatMessage({id: 'playbooks.task_lockdown_icon.remove_restriction', defaultMessage: 'Remove task restriction'}) : formatMessage({id: 'playbooks.task_lockdown_icon.add_restriction', defaultMessage: 'Restrict task to assignee'})}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                }
            }}
            style={{cursor: 'pointer', userSelect: 'none'}}
        >
            <LockComponent
                aria-hidden='true'
                size={16}
            />
        </span>
    );
};

export default TaskLockdownIcon;
