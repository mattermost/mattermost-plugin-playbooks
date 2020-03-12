// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Incident {
    id: string;
    name: string;
    is_closed: boolean;
    commander_user_id: string;
}
