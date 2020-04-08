// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Playbook {
    id: string;
    parent_id?: string;
    title: string;
    checklists: Checklist[];
}

export interface Checklist {
    title: string;
    items: ChecklistItem[];
}

export interface ChecklistItem {
    title: string;
    state: string;
}

export const ChecklistItemStateChecked = 'checked';
export const ChecklistItemStateUnchecked = 'unchecked';
