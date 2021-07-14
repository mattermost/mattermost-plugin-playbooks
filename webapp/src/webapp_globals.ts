// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type TTimestamp from 'mattermost-webapp/components/timestamp';

export const {
    formatText,
    messageHtmlToComponent,

    // @ts-ignore
} = global.PostUtils;

export const {
    Timestamp,

    // @ts-ignore
} = global.Components as {
    Timestamp: typeof TTimestamp;
};
