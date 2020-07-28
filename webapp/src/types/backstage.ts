// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from 'mattermost-redux/types/channels';

export interface CommanderInfo {
    user_id: string;
    username: string;
}

// Performs formatting of user posts including highlighting mentions and search terms and converting urls, hashtags,
// @mentions and ~channels to links by taking a user's message and returning a string of formatted html. Also takes
// a number of options as part of the second parameter:
export type ChannelNamesMap = {
    [name: string]: {
        display_name: string;
        team_name?: string;
    } | Channel;
};
