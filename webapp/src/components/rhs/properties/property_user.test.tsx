// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act, create} from 'react-test-renderer';

import {PropertyField, PropertyValue} from 'src/types/properties';

import UserProperty, {MultiuserProperty} from './property_user';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/hooks', () => ({
    useProfilesInTeam: () => [],
}));

jest.mock('src/components/profile/profile', () => ({
    __esModule: true,
    default: () => <div data-testid='profile'/>,
}));

jest.mock('src/components/profile/profile_selector', () => ({
    __esModule: true,
    default: () => <div data-testid='profile-selector'/>,
}));

const field: PropertyField = {
    id: 'field-1',
    group_id: '',
    name: 'Owner',
    type: 'user',
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

const makeValue = (value: string | string[]): PropertyValue => ({
    field_id: 'field-1',
    value,
} as unknown as PropertyValue);

const isEditing = (root: ReturnType<typeof create>['root']) =>
    root.findAllByProps({'data-testid': 'profile-selector'}).length > 0;

const triggerClick = (root: ReturnType<typeof create>['root']) => {
    const display = root.findByProps({'data-testid': 'property-value'});
    act(() => {
        display.props.onClick?.();
    });
};

const triggerEnterKey = (root: ReturnType<typeof create>['root']) => {
    const display = root.findByProps({'data-testid': 'property-value'});
    act(() => {
        display.props.onKeyDown?.({key: 'Enter', preventDefault: jest.fn()});
    });
};

describe('UserProperty readOnly guards', () => {
    it('does not enter edit mode on click when readOnly', () => {
        const component = create(
            <UserProperty
                field={field}
                value={makeValue('user-1')}
                runID='run-1'
                readOnly={true}
                onValueChange={jest.fn()}
            />,
        );
        triggerClick(component.root);
        expect(isEditing(component.root)).toBe(false);
    });

    it('does not enter edit mode on Enter key when readOnly', () => {
        const component = create(
            <UserProperty
                field={field}
                value={makeValue('user-1')}
                runID='run-1'
                readOnly={true}
                onValueChange={jest.fn()}
            />,
        );
        triggerEnterKey(component.root);
        expect(isEditing(component.root)).toBe(false);
    });

    it('enters edit mode on click when not readOnly', () => {
        const component = create(
            <UserProperty
                field={field}
                value={makeValue('user-1')}
                runID='run-1'
                onValueChange={jest.fn()}
            />,
        );
        triggerClick(component.root);
        expect(isEditing(component.root)).toBe(true);
    });
});

describe('MultiuserProperty readOnly guards', () => {
    it('does not enter edit mode on click when readOnly', () => {
        const component = create(
            <MultiuserProperty
                field={field}
                value={makeValue(['user-1'])}
                runID='run-1'
                readOnly={true}
                onValueChange={jest.fn()}
            />,
        );
        triggerClick(component.root);
        expect(isEditing(component.root)).toBe(false);
    });

    it('does not enter edit mode on Enter key when readOnly', () => {
        const component = create(
            <MultiuserProperty
                field={field}
                value={makeValue(['user-1'])}
                runID='run-1'
                readOnly={true}
                onValueChange={jest.fn()}
            />,
        );
        triggerEnterKey(component.root);
        expect(isEditing(component.root)).toBe(false);
    });

    it('enters edit mode on click when not readOnly', () => {
        const component = create(
            <MultiuserProperty
                field={field}
                value={makeValue(['user-1'])}
                runID='run-1'
                onValueChange={jest.fn()}
            />,
        );
        triggerClick(component.root);
        expect(isEditing(component.root)).toBe(true);
    });
});
