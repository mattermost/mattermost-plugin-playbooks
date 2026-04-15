// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import styled, {css} from 'styled-components';
import {CheckboxMultipleMarkedOutlineIcon} from '@mattermost/compass-icons/components';

import {useAppDispatch, useAppSelector} from 'src/hooks/redux';

import {closeBackstageRHS, openBackstageRHS} from 'src/actions';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';
import {backstageRHS, selectHasOverdueTasks} from 'src/selectors';

const IconButtonWrapper = styled.div<{$toggled: boolean}>`
    position: relative;
    display: flex;
    padding: 4px;
    border-radius: 5px;
    background: ${({$toggled}) => ($toggled ? 'var(--sidebar-text)' : 'transparent')};
    cursor: pointer;
`;

const UnreadBadge = styled.div<{$toggled: boolean}>`
    position: absolute;
    z-index: 1;
    top: 4px;
    right: 4px;
    width: 7px;
    height: 7px;
    background: var(--dnd-indicator);
    border-radius: 100%;
    box-shadow: 0 0 0 2px var(--global-header-background);

    ${({$toggled}) => $toggled && css`
        box-shadow: 0 0 0 2px var(--sidebar-text);
    `}
`;

const GlobalHeaderRight = () => {
    const dispatch = useAppDispatch();
    const {formatMessage} = useIntl();
    const isOpen = useAppSelector(backstageRHS.isOpen);
    const section = useAppSelector(backstageRHS.section);
    const hasOverdueTasks = useAppSelector(selectHasOverdueTasks);

    const isTasksOpen = isOpen && section === BackstageRHSSection.TaskInbox;

    const onClick = () => {
        if (isTasksOpen) {
            dispatch(closeBackstageRHS());
        } else {
            dispatch(openBackstageRHS(BackstageRHSSection.TaskInbox, BackstageRHSViewMode.Overlap));
        }
    };

    return (
        <WithTooltip
            title={formatMessage({defaultMessage: 'Tasks'})}
            id='tasks'
            forcedPlacement='bottom'
        >
            <IconButtonWrapper
                data-testid='header-task-inbox-icon'
                onClick={onClick}
                $toggled={isTasksOpen}
            >
                {hasOverdueTasks ? <UnreadBadge $toggled={isTasksOpen}/> : null}
                <CheckboxMultipleMarkedOutlineIcon
                    size={18}
                    color={isTasksOpen ? 'var(--team-sidebar)' : 'rgba(255,255,255,0.56)'}
                />
            </IconButtonWrapper>
        </WithTooltip>
    );
};

export default GlobalHeaderRight;
