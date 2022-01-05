// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {History} from 'history';

export const {
    formatText,
    messageHtmlToComponent,

    // @ts-ignore
} = global.PostUtils ?? {};

export const {
    modals,

// @ts-ignore
} = global.WebappUtils ?? {};

// @ts-ignore
export const browserHistory: History = global.WebappUtils.browserHistory ?? {};

export const {
    Timestamp,
    Textbox,

    // @ts-ignore
} = global.Components ?? {};
