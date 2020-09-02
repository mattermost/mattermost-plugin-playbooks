// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';

import classNames from 'classnames';
import styled from 'styled-components';

const Badge = styled.div`
    position: relative;
    top: 1px;
    display: inline-block;
    height: 24px;
    font-size: 12px;
    line-height: 24px;
    border-radius: 4px;
    padding: 0 8px;
    color: var(--center-channel-color-72);
    background-color: var(--center-channel-color-16);
    font-weight: 600;

    &.ongoing {
        color: var(--sidebar-text);
        background-color: var(--sidebar-bg);
    }
`;

const StatusBadge = (props: { isActive: boolean }) => (
    <Badge className={classNames({ongoing: props.isActive})}>
        {props.isActive ? 'Ongoing' : 'Ended'}
    </Badge>
);

export default StatusBadge;
