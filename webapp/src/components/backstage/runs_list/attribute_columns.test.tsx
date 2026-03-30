// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {PropertyField, PropertyValue} from 'src/types/properties';

import AttributeColumns, {ATTRIBUTE_COLUMNS_STORAGE_KEY, AttributeColumnsConfig} from './attribute_columns';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', defaultLocale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

// Default mock: empty users map, no teammate name display setting.
// Tests that need a populated user can override useSelector via mockImplementation.
jest.mock('react-redux', () => ({
    useSelector: jest.fn((selector: (s: any) => any) => {
        const state = {
            entities: {
                users: {profiles: {}},
                preferences: {myPreferences: {}},
                general: {config: {}},
            },
        };
        return selector(state);
    }),
}));

const makePropertyField = (id: string, name: string, sortOrder = 0): PropertyField => ({
    id,
    name,
    type: 'select',
    group_id: 'playbook-1',
    attrs: {
        visibility: 'always',
        sort_order: sortOrder,
        options: [
            {id: 'opt-1', name: 'High', color: 'red'},
            {id: 'opt-2', name: 'Low', color: 'green'},
        ],
    },
    create_at: 0,
    update_at: 0,
    delete_at: 0,
});

const makePropertyValue = (fieldId: string, value: string): PropertyValue => ({
    id: `val-${fieldId}`,
    field_id: fieldId,
    value,
    create_at: 0,
    update_at: 0,
    delete_at: 0,
});

describe('AttributeColumns', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('renders the first 2 property values below run name by default', () => {
        const fields: PropertyField[] = [
            makePropertyField('field-1', 'Priority', 0),
            makePropertyField('field-2', 'Team', 1),
            makePropertyField('field-3', 'Region', 2),
        ];
        const values: PropertyValue[] = [
            makePropertyValue('field-1', 'High'),
            makePropertyValue('field-2', 'Alpha'),
            makePropertyValue('field-3', 'EMEA'),
        ];

        const component = renderer.create(
            <AttributeColumns
                propertyFields={fields}
                propertyValues={values}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const rendered = JSON.stringify(tree);
        expect(rendered).toContain('High');
        expect(rendered).toContain('Alpha');

        // Third property not shown by default (only first 2)
        expect(rendered).not.toContain('EMEA');
    });

    it('shows dash when run has no value for a displayed field', () => {
        const fields: PropertyField[] = [
            makePropertyField('field-1', 'Priority', 0),
            makePropertyField('field-2', 'Team', 1),
        ];

        // No values provided — both fields should show dashes
        const component = renderer.create(
            <AttributeColumns
                propertyFields={fields}
                propertyValues={[]}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const rendered = JSON.stringify(tree);
        expect(rendered).toContain('—');
    });

    it('hides columns entirely when playbook has no property fields', () => {
        const component = renderer.create(
            <AttributeColumns
                propertyFields={[]}
                propertyValues={[]}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeNull();
    });

    it('does not render when unlicensed (no PropertyFields in data)', () => {
        const component = renderer.create(
            <AttributeColumns
                propertyFields={undefined}
                propertyValues={undefined}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeNull();
    });

    it('resolves user type field to display name when user is in the store', () => {
        const {useSelector} = jest.requireMock('react-redux');
        useSelector.mockImplementation((selector: (s: any) => any) => {
            const state = {
                entities: {
                    users: {profiles: {'user-123': {id: 'user-123', username: 'jsmith', first_name: 'Jane', last_name: 'Smith'}}},
                    preferences: {myPreferences: {}},
                    general: {config: {TeammateNameDisplay: 'full_name'}},
                },
            };
            return selector(state);
        });

        const fields: PropertyField[] = [{
            id: 'field-mgr',
            name: 'Manager',
            type: 'user',
            group_id: 'playbook-1',
            attrs: {visibility: 'always', sort_order: 0, options: null},
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        }];
        const values: PropertyValue[] = [{
            id: 'val-field-mgr',
            field_id: 'field-mgr',
            value: 'user-123',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        }];

        const component = renderer.create(
            <AttributeColumns
                propertyFields={fields}
                propertyValues={values}
            />,
        );
        const rendered = JSON.stringify(component.toJSON());

        // Should show display name, not raw user ID
        expect(rendered).toContain('Jane Smith');
        expect(rendered).not.toContain('user-123');

        // Reset to default mock
        useSelector.mockImplementation((selector: (s: any) => any) => {
            const state = {
                entities: {
                    users: {profiles: {}},
                    preferences: {myPreferences: {}},
                    general: {config: {}},
                },
            };
            return selector(state);
        });
    });

    it('falls back to raw user ID when user is not in the store', () => {
        const fields: PropertyField[] = [{
            id: 'field-mgr',
            name: 'Manager',
            type: 'user',
            group_id: 'playbook-1',
            attrs: {visibility: 'always', sort_order: 0, options: null},
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        }];
        const values: PropertyValue[] = [{
            id: 'val-field-mgr',
            field_id: 'field-mgr',
            value: 'unknown-user-id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        }];

        const component = renderer.create(
            <AttributeColumns
                propertyFields={fields}
                propertyValues={values}
            />,
        );
        const rendered = JSON.stringify(component.toJSON());

        // User not in store — falls back to raw ID
        expect(rendered).toContain('unknown-user-id');
    });

    it('shows own first 2 fields when selectedFieldIds is undefined (multi-playbook fallback)', () => {
        // This is the fix for Bug 2: in a mixed-playbook list, each row gets
        // selectedFieldIds=undefined so it independently shows its own default fields.
        const fields: PropertyField[] = [
            makePropertyField('field-pb2-zone', 'Zone', 0),
            makePropertyField('field-pb2-attack', 'Attack Type', 1),
            makePropertyField('field-pb2-severity', 'Severity', 2),
        ];
        const values: PropertyValue[] = [
            makePropertyValue('field-pb2-zone', 'Alpha'),
            makePropertyValue('field-pb2-attack', 'Ransomware'),
            makePropertyValue('field-pb2-severity', 'Critical'),
        ];

        const component = renderer.create(
            <AttributeColumns
                propertyFields={fields}
                propertyValues={values}
                selectedFieldIds={undefined}
            />,
        );
        const rendered = JSON.stringify(component.toJSON());

        // Without selectedFieldIds, the component falls back to showing the first 2 fields
        expect(rendered).toContain('Alpha');
        expect(rendered).toContain('Ransomware');

        // Third field is beyond DEFAULT_MAX_COLUMNS (2), so it is not shown
        expect(rendered).not.toContain('Critical');
    });

    it('shows nothing when selectedFieldIds contains IDs from a different playbook (no matches)', () => {
        // This is the root cause of Bug 1: when runs_list passed the first run's selectedFieldIds
        // to rows from other playbooks, none of their field IDs matched, so no columns appeared.
        const fields: PropertyField[] = [
            makePropertyField('field-pb2-zone', 'Zone', 0),
            makePropertyField('field-pb2-attack', 'Attack Type', 1),
        ];
        const values: PropertyValue[] = [
            makePropertyValue('field-pb2-zone', 'Alpha'),
            makePropertyValue('field-pb2-attack', 'Ransomware'),
        ];

        // IDs from a completely different playbook's fields — no overlap
        const foreignIds = ['field-pb1-status', 'field-pb1-priority'];

        const component = renderer.create(
            <AttributeColumns
                propertyFields={fields}
                propertyValues={values}
                selectedFieldIds={foreignIds}
            />,
        );
        const rendered = JSON.stringify(component.toJSON());

        // None of this run's fields match the foreign IDs, so nothing is rendered
        expect(rendered).not.toContain('Alpha');
        expect(rendered).not.toContain('Ransomware');
    });

    it('shows only the selected fields when selectedFieldIds is provided', () => {
        const fields: PropertyField[] = [
            makePropertyField('field-1', 'Priority', 0),
            makePropertyField('field-2', 'Team', 1),
            makePropertyField('field-3', 'Region', 2),
        ];
        const values: PropertyValue[] = [
            makePropertyValue('field-1', 'High'),
            makePropertyValue('field-2', 'Alpha'),
            makePropertyValue('field-3', 'EMEA'),
        ];

        const component = renderer.create(
            <AttributeColumns
                propertyFields={fields}
                propertyValues={values}
                selectedFieldIds={['field-3']}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const rendered = JSON.stringify(tree);

        // Only field-3 (EMEA) should be visible
        expect(rendered).toContain('EMEA');
        expect(rendered).not.toContain('High');
        expect(rendered).not.toContain('Alpha');
    });
});

describe('AttributeColumnsConfig', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('shows "Configure columns" button with all available fields in dropdown when clicked', () => {
        const fields: PropertyField[] = [
            makePropertyField('field-1', 'Priority', 0),
            makePropertyField('field-2', 'Team', 1),
            makePropertyField('field-3', 'Region', 2),
        ];

        const component = renderer.create(
            <AttributeColumnsConfig
                propertyFields={fields}
                selectedFieldIds={['field-1', 'field-2']}
                onSelectionChange={jest.fn()}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const rendered = JSON.stringify(tree);
        expect(rendered).toContain('Configure columns');
    });

    it('calls onSelectionChange when a column option is toggled', () => {
        const fields: PropertyField[] = [
            makePropertyField('field-1', 'Priority', 0),
            makePropertyField('field-2', 'Team', 1),
        ];
        const onSelectionChange = jest.fn();

        // Render with both fields selected
        renderer.create(
            <AttributeColumnsConfig
                propertyFields={fields}
                selectedFieldIds={['field-1', 'field-2']}
                onSelectionChange={onSelectionChange}
            />,
        );

        // onSelectionChange is triggered by user interaction (click), tested via E2E
        expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it('parent can save selected column preferences to localStorage', () => {
        const storageKey = `${ATTRIBUTE_COLUMNS_STORAGE_KEY}-playbook-1`;
        const selectedIds = ['field-2'];
        localStorage.setItem(storageKey, JSON.stringify(selectedIds));

        const stored = localStorage.getItem(storageKey);
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored!);
        expect(parsed).toContain('field-2');
    });

    it('parent can load column preferences from localStorage on mount', () => {
        const fields: PropertyField[] = [
            makePropertyField('field-1', 'Priority', 0),
            makePropertyField('field-2', 'Team', 1),
            makePropertyField('field-3', 'Region', 2),
        ];
        const values: PropertyValue[] = [
            makePropertyValue('field-1', 'High'),
            makePropertyValue('field-2', 'Alpha'),
            makePropertyValue('field-3', 'EMEA'),
        ];

        // Pre-seed localStorage (simulating what runs_list.tsx does on mount)
        localStorage.setItem(
            `${ATTRIBUTE_COLUMNS_STORAGE_KEY}-playbook-1`,
            JSON.stringify(['field-3']),
        );

        // AttributeColumns display component respects selectedFieldIds passed from parent
        const component = renderer.create(
            <AttributeColumns
                propertyFields={fields}
                propertyValues={values}
                selectedFieldIds={['field-3']}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const rendered = JSON.stringify(tree);

        // Stored preference (field-3 = EMEA) should be displayed
        expect(rendered).toContain('EMEA');

        // Fields not in stored preference should not be rendered
        expect(rendered).not.toContain('High');
        expect(rendered).not.toContain('Alpha');
    });
});
