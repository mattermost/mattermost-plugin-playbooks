// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';

import {openBackstageRHS, closeBackstageRHS} from 'src/actions';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';
import {OVERLAY_DELAY} from 'src/constants';
import {backstageRHS, selectHasOverdueTasks} from 'src/selectors';
import {IconButton} from 'src/webapp_globals';

const IconButtonWrapper = styled.div`
    position: relative;
`;

const UnreadBadge = styled.div<{toggled: boolean}>`
    position: absolute;
    z-index: 1;
    top: 4px;
    right: 4px;
    width: 7px;
    height: 7px;
    background: var(--dnd-indicator);
    border-radius: 100%;
    box-shadow: 0 0 0 2px var(--global-header-background);

    ${({toggled}) => toggled && css`
        box-shadow: 0 0 0 2px var(--sidebar-text);
    `}
`;

const GlobalHeaderRight = () => {
    const dispatch = useDispatch();
    const isOpen = useSelector(backstageRHS.isOpen);
    const viewMode = useSelector(backstageRHS.viewMode);
    const section = useSelector(backstageRHS.section);
    const hasOverdueTasks = useSelector(selectHasOverdueTasks);
    const {formatMessage} = useIntl();

    const isTasksOpen = isOpen && section === BackstageRHSSection.TaskInbox;

    const onClick = () => {
        if (isTasksOpen) {
            dispatch(closeBackstageRHS());
        } else {
            dispatch(openBackstageRHS(BackstageRHSSection.TaskInbox, BackstageRHSViewMode.Overlap));
        }
    };

    const tooltip = (
        <Tooltip id='tasks'>
            {formatMessage({
                defaultMessage: 'Tasks',
            })}
        </Tooltip>
    );

    return (
        <OverlayTrigger
            trigger={['hover', 'focus']}
            delay={OVERLAY_DELAY}
            placement='bottom'
            overlay={tooltip}
        >
            <IconButtonWrapper>
                {hasOverdueTasks ? <UnreadBadge toggled={isTasksOpen}/> : null}
                <IconButton
                    size={'sm'}
                    icon={'checkbox-multiple-marked-outline'}
                    toggled={isTasksOpen}
                    onClick={onClick}
                    inverted={true}
                    compact={true}
                    aria-label='Select to toggle a list of tasks.' // proper wording and translation needed
                />
            </IconButtonWrapper>
        </OverlayTrigger>
    );
};

export default GlobalHeaderRight;
