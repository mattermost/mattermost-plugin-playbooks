import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {TaskAction as TaskActionType} from 'src/types/playbook';
import {openTaskActionsModal} from 'src/actions';

interface TaskActionsProps {
    taskActions?: TaskActionType[] | null
    onTaskActionsChange: (newTaskActions: TaskActionType[]) => void;
    playbookRunId?: string;
}

const TaskActions = (props: TaskActionsProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const lenTasks = props.taskActions ? props.taskActions.length:0
    var placeholder = (
        <FormattedMessage
        defaultMessage="{actions, plural, =0 {Task Actions} one {# action} other {# actions}}"
        values = {{"actions": lenTasks, }}
        />
    )

    return (
        <TaskActionsContainer
                isPlaceholder={lenTasks<1}
                onClick={() => { dispatch(openTaskActionsModal(props.onTaskActionsChange, props.taskActions, props.playbookRunId)) }}
        >
                <ActionIcon
                    title={formatMessage({defaultMessage: 'Task Actions...'})}
                    className={'icon-lightning-bolt-outline icon-12'}
                />
                <TaskActionsTextContainer>
                    {placeholder}
                </TaskActionsTextContainer>
        </TaskActionsContainer>
    )
};

export default TaskActions;

const TaskActionsContainer = styled.div<{isPlaceholder: boolean}>`
    align-items: center;
    background: ${({isPlaceholder}) => (isPlaceholder ? 'transparent' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    border-radius: 13px;
    border: ${({isPlaceholder}) => (isPlaceholder ? '1px solid rgba(var(--center-channel-color-rgb), 0.08)' : 'none')}; ;
    color: ${({isPlaceholder}) => (isPlaceholder ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--center-channel-color)')};
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    height: 24px;
    max-width: 100%;
    padding: 2px 4px;
    &:hover {
        cursor: pointer;
    }
`;

const ActionIcon = styled.i`
    align-items: center;
    color: rgba(var(--center-channel-color-rgb),0.56);
    display: flex;
    flex: table;
    height: 20px;
    margin-right: 3px;
    text-align: center;
    width: 20px;
`;

const TaskActionsTextContainer = styled.div`
    align-items: center;
    display: flex;
    font-size: 12px;
    margin-right: 8px;
    text-align: center;
    white-space: nowrap;
    padding-bottom:  1px;
`;
