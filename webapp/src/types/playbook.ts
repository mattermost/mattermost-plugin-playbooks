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
    checked_modified?: string;
    checked_post_id?: string;
    command: string;
}

export function emptyPlaybook(): Playbook {
    return {
        title: '',
        team_id: '',
        create_public_incident: false,
        checklists: [{
            title: 'Checklist',
            items: [],
        }],
    };
}

// eslint-disable-next-line
export function isPlaybook(arg: any): arg is Playbook {
    return arg &&
        typeof arg.id === 'string' &&
        typeof arg.title === 'string' &&
        typeof arg.team_id === 'string' &&
        typeof arg.create_public_incident === 'boolean' &&
        arg.checklists && Array.isArray(arg.checklists) && arg.checklists.every(isChecklist);
}

// eslint-disable-next-line
export function isChecklist(arg: any): arg is Checklist {
    return arg &&
        typeof arg.title === 'string' &&
        arg.items && Array.isArray(arg.items) && arg.items.every(isChecklistItem);
}

// eslint-disable-next-line
export function isChecklistItem(arg: any): arg is ChecklistItem {
    return arg &&
        typeof arg.title === 'string' &&
        typeof arg.checked_post_id === 'string' &&
        typeof arg.checked_modified === 'string' &&
        typeof arg.checked === 'boolean' &&
        typeof arg.command === 'string';
}
