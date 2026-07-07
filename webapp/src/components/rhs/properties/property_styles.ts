// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';

// Shared cursor/hover affordance for editable property displays. When $readOnly
// is set the pointer cursor and hover highlight are suppressed.
export const readOnlyInteractiveStyles = css<{$readOnly?: boolean}>`
    cursor: ${({$readOnly}) => ($readOnly ? 'default' : 'pointer')};

    &:hover {
        ${({$readOnly}) => !$readOnly && `
            background-color: rgba(var(--center-channel-color-rgb), 0.04);
            border-radius: 4px;
            margin: 0 -4px;
            padding: 4px;
        `}
    }
`;

export const PropertyDisplayContainer = styled.div.attrs<{$readOnly?: boolean}>(({$readOnly}) => ({
    role: $readOnly ? undefined : 'button',
    tabIndex: $readOnly ? undefined : 0,
}))<{$readOnly?: boolean}>`
    flex: 1;
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
    padding: 4px 0;
    min-height: 20px;

    ${readOnlyInteractiveStyles}

    &:focus-visible {
        ${({$readOnly}) => !$readOnly && `
            outline: 2px solid var(--button-bg);
            outline-offset: 2px;
            border-radius: 4px;
        `}
    }
`;
