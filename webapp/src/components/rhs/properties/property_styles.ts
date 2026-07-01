// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

export const PropertyDisplayContainer = styled.div.attrs<{$readOnly?: boolean}>(({$readOnly}) => ({
    role: $readOnly ? undefined : 'button',
    tabIndex: $readOnly ? undefined : 0,
    onKeyDown: $readOnly ? undefined : (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            (e.currentTarget as HTMLElement).click();
        }
    },
}))<{$readOnly?: boolean}>`
    flex: 1;
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
    cursor: ${({$readOnly}) => ($readOnly ? 'default' : 'pointer')};
    padding: 4px 0;
    min-height: 20px;

    &:hover {
        ${({$readOnly}) => !$readOnly && `
            background-color: rgba(var(--center-channel-color-rgb), 0.04);
            border-radius: 4px;
            margin: 0 -4px;
            padding: 4px;
        `}
    }

    &:focus-visible {
        ${({$readOnly}) => !$readOnly && `
            outline: 2px solid var(--button-bg);
            outline-offset: 2px;
            border-radius: 4px;
        `}
    }
`;
