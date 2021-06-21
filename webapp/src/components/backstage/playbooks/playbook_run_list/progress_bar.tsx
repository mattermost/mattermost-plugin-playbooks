// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

const ProgBarOuter = styled.div`
    margin: 10px 0;
    background-color: rgba(var(--button-bg-rgb), 0.08);
    width: 80px;
    height: 4px;
    border-radius: 2px;
`;

const ProgBarInner = styled.div<{ percentage: number }>`
    background-color: var(--button-bg);
    border-radius: 2px;
    height: 100%;
    width: ${(props) => props.percentage}%;
`;

const ProgressBar = (props: { completed: number, total: number }) => {
    const percentage = props.total === 0 ? 0 : (props.completed / props.total) * 100;

    return (
        <ProgBarOuter>
            <ProgBarInner percentage={percentage}/>
        </ProgBarOuter>
    );
};

export default ProgressBar;
