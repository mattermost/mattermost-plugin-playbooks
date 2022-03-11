// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface ChannelAction {
    id?: string;
    channel_id: string;
    enabled: boolean;
    delete_at?: number;
    action_type: ChannelActionType;
    trigger_type: ChannelTriggerType;
    payload: PayloadType;
}

export enum ChannelActionType {
    WelcomeMessage = 'send_welcome_message',
    PromptRunPlaybook = 'prompt_run_playbook',
}

export enum ChannelTriggerType {
    NewMemberJoins = 'new_member_joins',
    KeywordsPosted = 'keywords',
}

type PayloadType = WelcomeMessageActionPayload | PromptRunPlaybookFromKeywordsPayload;

export interface WelcomeMessageActionPayload {
    message: string;
}

export interface PromptRunPlaybookFromKeywordsPayload {
    keywords: string[];
    playbook_id: string;
}

export type ActionsByTrigger = Record<ChannelTriggerType, ChannelAction[]>;

export const equalActionType = (a: ChannelAction, b: ChannelAction) => {
    if (a.action_type !== b.action_type) {
        return false;
    }

    if (a.trigger_type !== b.trigger_type) {
        return false;
    }

    switch (a.trigger_type) {
    case ChannelTriggerType.NewMemberJoins:
        return true;
    case ChannelTriggerType.KeywordsPosted: {
        const aPayload = a.payload as PromptRunPlaybookFromKeywordsPayload;
        const bPayload = b.payload as PromptRunPlaybookFromKeywordsPayload;

        return arrayEquals(aPayload.keywords, bPayload.keywords);
    }
    }

    return false;
};

function arrayEquals<T>(a: T[], b: T[]) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
}
