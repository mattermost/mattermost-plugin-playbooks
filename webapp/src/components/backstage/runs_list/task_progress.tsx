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

    if (taskTotal == null || taskTotal === 0) {
        return null;
    }

    const completed = taskCompleted ?? 0;
    const pct = Math.round(Math.min((completed / taskTotal) * 100, 100));
    const label = formatMessage(
        {id: 'pqR8tZ', defaultMessage: '{completed, number}/{total, number} tasks'},
        {completed, total: taskTotal},
    );

    return (
        <Container data-testid='task-progress-indicator'>
            <Label>{label}</Label>
            <Bar
                role='progressbar'
                aria-label={label}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <Fill style={{width: `${pct}%`}}/>
            </Bar>
        </Container>
    );
};

export default TaskProgress;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
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
