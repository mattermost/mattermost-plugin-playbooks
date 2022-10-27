// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface RunActions {
    status_update_broadcast_channels_enabled: boolean;
    broadcast_channel_ids: string[];

    status_update_broadcast_webhooks_enabled: boolean;
    webhook_on_status_update_urls: string[];

    create_channel_member_on_new_participant: boolean,
    remove_channel_member_on_removed_participant: boolean,
}
