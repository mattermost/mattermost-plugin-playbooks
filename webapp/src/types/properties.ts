// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Types that match the actual HTTP API response structure for properties

import type {FieldVisibility, PropertyField as PropertyFieldBase, PropertyFieldOption} from '@mattermost/types/properties';

export type PropertyField = PropertyFieldBase & {
    target_type?: 'playbook' | 'run';
    attrs: {
        visibility: FieldVisibility;
        sort_order: number;
        options: PropertyFieldOption[] | null;
        parent_id?: string;
        value_type?: string;
    };
};

export type PropertyValue = {
    id: string;
    field_id: string;
    value?: string | string[] | number;
    target_id?: string;
    target_type?: string;
    group_id?: string;
    create_at: number;
    update_at: number;
    delete_at: number;
}

export enum PropertyFieldType {
    Date = 'date',
    Multiselect = 'multiselect',
    Multiuser = 'multiuser',
    Select = 'select',
    Text = 'text',
    User = 'user'
}

export type PropertyOptionInput = {
    id?: string;
    name: string;
    color?: string;
};

export type PropertyFieldAttrsInput = {
    visibility?: FieldVisibility;
    sort_order?: number;
    options?: PropertyOptionInput[];
    parent_id?: string;
    value_type?: string;
};

export type PropertyFieldInput = {
    name: string;
    type: PropertyField['type'];
    attrs?: PropertyFieldAttrsInput;
};

export interface PropertyComponentProps {
    field: PropertyField;
    value?: PropertyValue;
    runID: string;
}
