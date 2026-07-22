// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {css} from 'styled-components';

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
