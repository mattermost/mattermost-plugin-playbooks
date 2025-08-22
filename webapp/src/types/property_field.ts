// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type PropertyField = {
    id: string;
    group_id: string;
    name: string;
    type: 'text' | 'select' | 'multiselect' | 'date' | 'user' | 'multiuser';
    attrs: {
        visibility?: 'hidden' | 'when_set' | 'always';
        sort_order?: number;
        options?: Array<{
            id: string;
            name: string;
            color?: string;
        }>;
        parent_id?: string;
    };
    target_id: string;
    target_type: 'playbook' | 'run';
    create_at: number;
    update_at: number;
    delete_at: number;
};