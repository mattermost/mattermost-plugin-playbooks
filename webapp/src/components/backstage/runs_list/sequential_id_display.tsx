// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

interface Props {
    sequentialId: string;
}

const SequentialIdDisplay = ({sequentialId}: Props) => (
    <SequentialId data-testid='run-sequential-id'>
        {sequentialId}
    </SequentialId>
);

const SequentialId = styled.span`
    font-weight: 600;
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    padding: 2px 6px;
    white-space: nowrap;
`;

export default SequentialIdDisplay;
