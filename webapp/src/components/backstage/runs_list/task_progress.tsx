// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

interface Props {
    taskTotal?: number;
    taskCompleted?: number;
}

const TaskProgress = ({taskTotal, taskCompleted}: Props) => {
    const {formatMessage} = useIntl();

    if (!taskTotal) {
        return null;
    }

    const completed = taskCompleted ?? 0;
    const pct = Math.round((completed / taskTotal) * 100);

    return (
        <Container data-testid='task-progress-indicator'>
            <Label>
                {formatMessage(
                    {id: 'playbooks.task_progress.label', defaultMessage: '{completed}/{total} tasks'},
                    {completed, total: taskTotal},
                )}
            </Label>
            <Bar>
                <Fill style={{width: `${pct}%`}}/>
            </Bar>
        </Container>
    );
};

export default TaskProgress;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 80px;
`;

const Label = styled.span`
    font-size: 11px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const Bar = styled.div`
    height: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 2px;
    overflow: hidden;
`;

const Fill = styled.div`
    height: 100%;
    background: var(--button-bg);
    border-radius: 2px;
    transition: width 0.2s ease;
`;
