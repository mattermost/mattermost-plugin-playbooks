// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act, create} from 'react-test-renderer';

import {PropertyField, PropertyValue} from 'src/types/properties';

import TextProperty from './property_text';

jest.mock('./property_text_input', () => ({
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
    name: 'Summary',
    type: 'text',
    target_id: '',
    target_type: 'run',
    object_type: 'run',
    attrs: {visibility: 'always', sort_order: 0, options: null},
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
} as unknown as PropertyField;

const value: PropertyValue = {field_id: 'field-1', value: 'hello'} as unknown as PropertyValue;

const isEditing = (root: ReturnType<typeof create>['root']) =>
    root.findAllByProps({'data-testid': 'edit-mode'}).length > 0;

const triggerClick = (root: ReturnType<typeof create>['root']) => {
    const display = root.findByProps({'data-testid': 'property-value'});
    act(() => {
        display.props.onClick?.();
    });
};

describe('TextProperty readOnly guards', () => {
    it('does not enter edit mode on click when readOnly', () => {
        const component = create(
            <TextProperty
                field={field}
                value={value}
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
            <TextProperty
                field={field}
                value={value}
                runID='run-1'
                onValueChange={jest.fn()}
            />,
        );
        triggerClick(component.root);
        expect(isEditing(component.root)).toBe(true);
    });
});
