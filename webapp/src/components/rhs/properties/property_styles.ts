// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

/**
 * Shared display container for property values. Provides consistent hover
 * affordance across all property type components (text, date, user, select, multiselect).
 */
export const PropertyDisplayContainer = styled.div.attrs(() => ({
    role: 'button',
    tabIndex: 0,
}))`
    flex: 1;
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
    cursor: pointer;
    padding: 4px 0;
    min-height: 20px;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04);
        border-radius: 4px;
        margin: 0 -4px;
        padding: 4px;
    }

    &:focus-visible {
        outline: 2px solid var(--button-bg);
        outline-offset: 2px;
        border-radius: 4px;
    }
`;
