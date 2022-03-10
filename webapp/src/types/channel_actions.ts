// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface ChannelAction {
    id?: string;
    channel_id: string;
    enabled: boolean;
    delete_at?: number;
    action_type: ChannelActionType;
    trigger_type: ChannelTriggerType;

    // TODO: Add a union type here when more payloads are added
    payload: WelcomeMessageActionPayload;
}

export enum ChannelActionType {
    WelcomeMessage = 'send_welcome_message',
}

export enum ChannelTriggerType {
    NewMemberJoins = 'new_member_joins',
}

export interface WelcomeMessageActionPayload {
    message: string;
}

export type ActionsByTrigger = Record<ChannelTriggerType, ChannelAction[]>;
