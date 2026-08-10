// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {KeyboardEvent, MouseEvent} from 'react';
import styled from 'styled-components';
import {FormattedMessage} from 'react-intl';
import {ControlProps, components} from 'react-select';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';

import {Option} from 'src/components/profile/profile_selector';

const toggleAssigneeOnlyComplete = (ownProps: ControlProps<Option, boolean>) => {
    ownProps.selectProps.onAssigneeOnlyCompleteChange?.(
        !ownProps.selectProps.assigneeOnlyComplete,
    );
};

export const AssigneeOnlyCompleteControl = (ownProps: ControlProps<Option, boolean>) => {
    const checked = Boolean(ownProps.selectProps.assigneeOnlyComplete);

    const onRowClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAssigneeOnlyComplete(ownProps);
    };

    const onRowKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggleAssigneeOnlyComplete(ownProps);
        }
    };

    return (
        <div>
            <components.Control {...ownProps}/>
            {ownProps.selectProps.showAssigneeOnlyComplete && (
                <AssigneeOnlyCompleteRow
                    data-testid='assignee-only-complete-toggle'
                    role='checkbox'
                    aria-checked={checked}
                    tabIndex={0}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onClick={onRowClick}
                    onKeyDown={onRowKeyDown}
                >
                    <AssigneeOnlyCompleteCheckbox
                        type='checkbox'
                        checked={checked}
                        readOnly={true}
                        tabIndex={-1}
                    />
                    <LockOutlineIcon size={14}/>
                    <AssigneeOnlyCompleteLabel>
                        <FormattedMessage defaultMessage='Only the assignee can complete the task'/>
                    </AssigneeOnlyCompleteLabel>
                </AssigneeOnlyCompleteRow>
            )}
            {ownProps.selectProps.showCustomReset && (
                <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                    <FormattedMessage defaultMessage='No Assignee'/>
                </ControlComponentAnchor>
            )}
        </div>
    );
};

const AssigneeOnlyCompleteRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px 10px;
    cursor: pointer;
    user-select: none;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const AssigneeOnlyCompleteCheckbox = styled.input`
    margin: 0;
    cursor: pointer;
`;

const AssigneeOnlyCompleteLabel = styled.span`
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    color: var(--center-channel-color);
`;

const ControlComponentAnchor = styled.a`
    position: relative;
    top: -4px;
    display: inline-block;
    margin: 0 0 8px 12px;
    font-size: 12px;
    font-weight: 600;
`;
