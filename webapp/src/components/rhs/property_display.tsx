// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

interface Props {
    value?: string;
    onClick: () => void;
}

const PropertyDisplay = (props: Props) => {
    const displayValue = props.value || 'Empty';
    const isEmpty = displayValue === 'Empty';

    return (
        <Display
            onClick={props.onClick}
            $isEmpty={isEmpty}
        >
            {displayValue}
        </Display>
    );
};

const Display = styled.div<{$isEmpty?: boolean}>`
    color: ${(props) => (props.$isEmpty ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--center-channel-color)')};
    font-size: 14px;
    line-height: 24px;
    flex: 1;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

export default PropertyDisplay;