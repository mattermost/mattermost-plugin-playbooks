// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {openBackstageRHS, closeBackstageRHS} from 'src/actions';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';
import {OVERLAY_DELAY} from 'src/constants';
import {backstageRHS} from 'src/selectors';
import {IconButton} from 'src/webapp_globals';

const GlobalHeaderRight = () => {
    const dispatch = useDispatch();
    const isOpen = useSelector(backstageRHS.isOpen);
    const viewMode = useSelector(backstageRHS.viewMode);
    const section = useSelector(backstageRHS.section);
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
            <IconButton
                size={'sm'}
                icon={'checkbox-multiple-marked-outline'}
                toggled={isTasksOpen}
                onClick={onClick}
                inverted={true}
                compact={true}
                aria-label='Select to toggle a list of tasks.' // proper wording and translation needed
            />
        </OverlayTrigger>
    );
};

export default GlobalHeaderRight;
