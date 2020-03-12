// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Incident {
    id: string;
    name: string;
    state: number; // Will be removed in favor of isClosed
    commander_user_id: string;
}
