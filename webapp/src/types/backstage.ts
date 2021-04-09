// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from 'mattermost-redux/types/channels';

export interface CommanderInfo {
    user_id: string;
    username: string;
}

export type ChannelNamesMap = {
    [name: string]: {
        display_name: string;
        team_name?: string;
    } | Channel;
};

// eslint-disable-next-line no-shadow
export enum IncidentBackstageTabState {
    ViewingOverview,
    ViewingRetrospective,
}

