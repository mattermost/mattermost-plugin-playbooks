// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act, create} from 'react-test-renderer';

import {PropertyField, PropertyValue} from 'src/types/properties';

import SelectProperty from './property_select';

jest.mock('./property_select_input', () => ({
    __esModule: true,
    default: () => <div data-testid='edit-mode'/>,
}));

jest.mock('./empty_state', () => ({
    __esModule: true,
    default: () => <div data-testid='empty'/>,
}));

const field: PropertyField = {
    id: 'field-1',
    group_id: '',
    name: 'Priority',
    type: 'select',
    target_id: '',
    target_type: 'run',
    object_type: 'run',
    attrs: {
        visibility: 'always',
        sort_order: 0,
        options: [{id: 'opt-1', name: 'High'}],
    },
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
} as unknown as PropertyField;

const emptyValue: PropertyValue = {field_id: 'field-1', value: ''} as unknown as PropertyValue;
const populatedValue: PropertyValue = {field_id: 'field-1', value: 'opt-1'} as unknown as PropertyValue;

const isEditing = (root: ReturnType<typeof create>['root']) =>
    root.findAllByProps({'data-testid': 'edit-mode'}).length > 0;

const triggerClick = (root: ReturnType<typeof create>['root']) => {
    const display = root.findByProps({'data-testid': 'property-value'});
    act(() => {
        display.props.onClick?.();
    });
};

describe('SelectProperty readOnly guards', () => {
    it('does not enter edit mode on click when readOnly', () => {
        const component = create(
            <SelectProperty
                field={field}
                value={emptyValue}
                runID='run-1'
                readOnly={true}
                onValueChange={jest.fn()}
            />,
        );
        triggerClick(component.root);
        expect(isEditing(component.root)).toBe(false);
    });

    it('enters edit mode on click when not readOnly', () => {
        const component = create(
            <SelectProperty
                field={field}
                value={emptyValue}
                runID='run-1'
                onValueChange={jest.fn()}
            />,
        );
        triggerClick(component.root);
        expect(isEditing(component.root)).toBe(true);
    });

    it('renders the selected chip with an undefined onClick when readOnly', () => {
        const component = create(
            <SelectProperty
                field={field}
                value={populatedValue}
                runID='run-1'
                readOnly={true}
                onValueChange={jest.fn()}
            />,
        );
        const chip = component.root.findByProps({label: 'High'});
        expect(chip.props.onClick).toBeUndefined();
    });

    it('renders the selected chip with a defined onClick when not readOnly', () => {
        const component = create(
            <SelectProperty
                field={field}
                value={populatedValue}
                runID='run-1'
                onValueChange={jest.fn()}
            />,
        );
        const chip = component.root.findByProps({label: 'High'});
        expect(chip.props.onClick).toBeDefined();
    });
});
