// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Types that match the actual HTTP API response structure for properties

export interface PropertyFieldOption {
    id: string;
    name: string;
    color?: string;
}

export interface PropertyFieldAttrs {
    visibility: string;
    sort_order: number;
    options: PropertyFieldOption[] | null;
    parent_id: string;
}

export interface PropertyField {
    id: string;
    group_id: string;
    name: string;
    type: string;
    target_id: string;
    target_type: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    attrs: PropertyFieldAttrs;
}

export interface PropertyValue {
    id: string;
    target_id: string;
    target_type: string;
    group_id: string;
    field_id: string; // Note: snake_case, not camelCase
    value: string | string[];
    create_at: number;
    update_at: number;
    delete_at: number;
}