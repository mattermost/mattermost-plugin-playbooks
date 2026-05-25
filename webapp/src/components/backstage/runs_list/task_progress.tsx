// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useId} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

interface Props {
    taskTotal?: number;
    taskCompleted?: number;
}

const TaskProgress = ({taskTotal, taskCompleted}: Props) => {
    const {formatMessage} = useIntl();
    const labelId = useId();

    if (taskTotal == null || taskTotal === 0) {
        return null;
    }

    const completed = taskCompleted ?? 0;
    const pct = Math.round(Math.min((completed / taskTotal) * 100, 100));
    const label = formatMessage(
        {defaultMessage: '{completed, number}/{total, number} tasks'},
        {completed, total: taskTotal},
    );

    return (
        <Container data-testid='task-progress-indicator'>
            <Label id={labelId}>{label}</Label>
            <Bar
                role='progressbar'
                aria-labelledby={labelId}
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
    gap: 8px;
    min-width: 80px;
    padding-right: 24px;
`;

const Label = styled.span`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const Bar = styled.div`
    height: 6px;
    background: rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 10px;
    overflow: hidden;
`;

const Fill = styled.div`
    height: 100%;
    background: var(--button-bg);
    border-radius: 2px;
    transition: width 0.2s ease;
`;
