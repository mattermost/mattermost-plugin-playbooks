// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';

import styled, {css} from 'styled-components';

import {FormattedMessage} from 'react-intl';

import {PlaybookRunStatus} from 'src/types/playbook_run';

interface BadgeProps {
    status: PlaybookRunStatus;
    compact?: boolean;
}

const Badge = styled.div<BadgeProps>`
    position: relative;
    display: inline-block;
    font-size: 12px;
    border-radius: 4px;
    padding: 0 8px;
    font-weight: 600;
    margin: 2px;

    color: var(--sidebar-text);

    ${(props) => {
        switch (props.status) {
        case PlaybookRunStatus.InProgress:
            return css`
                background-color: var(--sidebar-text-active-border);
        `;
        case PlaybookRunStatus.Finished:
            return css`
                background-color: var(--center-channel-color-64);
        `;
        default:
            return css`
                color: var(--center-channel-color);
                box-shadow: gray 0 0 2pt;
        `;
        }
    }}


    top: 1px;
    height: 24px;
    line-height: 24px;

    ${(props) => props.compact && css`
        line-height: 20px;
        height: 20px;
    `}
`;

const StatusBadge = (props: BadgeProps) => (
    <Badge {...props}>
        {props.status === PlaybookRunStatus.InProgress ? <FormattedMessage defaultMessage='In Progress'/> : props.status}
    </Badge>
);

export default StatusBadge;
