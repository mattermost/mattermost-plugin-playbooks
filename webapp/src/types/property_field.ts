// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FieldVisibility, PropertyField as PropertyFieldBase, PropertyFieldOption} from '@mattermost/types/properties';

export type PropertyField = PropertyFieldBase & {
    target_type: 'playbook' | 'run';
    attrs: {
        visibility?: FieldVisibility;
        sort_order?: number;
        options?: PropertyFieldOption[];
        parent_id?: string;
    };
};
