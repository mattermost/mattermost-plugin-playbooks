// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Playbook {
    id?: string;
    title: string;
    team_id: string;
    create_public_incident: boolean;
    checklists: Checklist[];
}

export interface Checklist {
    title: string;
    items: ChecklistItem[];
}

export interface ChecklistItem {
    title: string;
    checked: boolean;
    checked_modified: string;
    checked_post_id: string;
}

export function newPlaybook(): Playbook {
    return {
        title: '',
        team_id: '',
        checklists: [{
            title: 'Checklist',
            items: [],
        }],
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPlaybook(arg: any): arg is Playbook {
    return arg &&
        typeof arg.id === 'string' &&
        typeof arg.title === 'string' &&
        typeof arg.team_id === 'string' &&
        typeof arg.create_public_incident === 'boolean' &&
        arg.checklists && Array.isArray(arg.checklists) && arg.checklists.every(isChecklist);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isChecklist(arg: any): arg is Checklist {
    return arg &&
        typeof arg.title === 'string' &&
        arg.items && Array.isArray(arg.items) && arg.items.every(isChecklistItem);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isChecklistItem(arg: any): arg is ChecklistItem {
    return arg &&
        typeof arg.title === 'string' &&
        typeof arg.checked_post_id === 'string' &&
        typeof arg.checked_modified === 'string' &&
        typeof arg.checked === 'boolean';
}
