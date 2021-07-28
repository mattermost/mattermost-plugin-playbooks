// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {css} from 'styled-components';

/**
 * Visually hide while leaving accessible
 * @source {@link https://www.a11yproject.com/posts/2013-01-11-how-to-hide-content/}
 */
export const visuallyHidden = css`
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    width: 1px;
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
`;
