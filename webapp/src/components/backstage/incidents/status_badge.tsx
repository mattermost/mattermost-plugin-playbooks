// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';

import styled, {css} from 'styled-components';

interface BadgeProps {
    isActive?: boolean;
    compact?: boolean;
}

const Badge = styled.div<BadgeProps>`
    position: relative;
    display: inline-block;
    font-size: 12px;
    border-radius: 4px;
    padding: 0 8px;
    font-weight: 600;

    color: var(--center-channel-color-72);
    background-color: var(--center-channel-color-16);

    ${(props) => props.isActive && css`
        color: var(--sidebar-text);
        background-color: var(--sidebar-bg);
    `}

    top: 1px;
    height: 24px;
    line-height: 24px;

    ${(props) => props.compact && css`
        line-height: 21px;
        height: 21px;
    `}
`;

const StatusBadge = (props: BadgeProps) => (
    <Badge {...props}>
        {props.isActive ? 'Ongoing' : 'Ended'}
    </Badge>
);

export default StatusBadge;
