// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {PropertyField} from 'src/types/properties';

import RHSProperty from './rhs_property';

jest.mock('src/graphql/hooks', () => ({
    useSetRunPropertyValue: jest.fn(() => [jest.fn().mockResolvedValue({errors: []})]),
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: jest.fn(() => ({add: jest.fn()})),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('./properties/property_text', () => ({
    __esModule: true,
    default: () => <div data-testid='mock-text-property'/>,
}));

jest.mock('./properties/property_select', () => ({
    __esModule: true,
    default: () => <div data-testid='mock-select-property'/>,
}));

jest.mock('./properties/property_multiselect', () => ({
    __esModule: true,
    default: () => <div data-testid='mock-multiselect-property'/>,
}));

jest.mock('./properties/property_user', () => ({
    __esModule: true,
    default: () => <div data-testid='mock-user-property'/>,
    MultiuserProperty: () => <div data-testid='mock-multiuser-property'/>,
}));

jest.mock('./properties/property_date', () => ({
    __esModule: true,
    default: () => <div data-testid='mock-date-property'/>,
}));

const makeField = (type: string) => ({
    id: 'field-1',
    group_id: '',
    name: 'TestField',
    type: type as PropertyField['type'],
    target_id: '',
    target_type: 'run' as const,
    object_type: 'run',
    attrs: {visibility: 'always' as const, sort_order: 0, options: null},
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

describe('RHSProperty', () => {
    it('renders TextProperty for type=text', () => {
        const component = renderer.create(
            <RHSProperty
                field={makeField('text')}
                runID='run-1'
            />,
        );
        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'mock-text-property'})).toBeTruthy();
    });

    it('renders SelectProperty for type=select', () => {
        const component = renderer.create(
            <RHSProperty
                field={makeField('select')}
                runID='run-1'
            />,
        );
        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'mock-select-property'})).toBeTruthy();
    });

    it('renders MultiselectProperty for type=multiselect', () => {
        const component = renderer.create(
            <RHSProperty
                field={makeField('multiselect')}
                runID='run-1'
            />,
        );
        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'mock-multiselect-property'})).toBeTruthy();
    });

    it('renders UserProperty for type=user', () => {
        const component = renderer.create(
            <RHSProperty
                field={makeField('user')}
                runID='run-1'
            />,
        );
        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'mock-user-property'})).toBeTruthy();
    });

    it('renders MultiuserProperty for type=multiuser', () => {
        const component = renderer.create(
            <RHSProperty
                field={makeField('multiuser')}
                runID='run-1'
            />,
        );
        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'mock-multiuser-property'})).toBeTruthy();
    });

    it('renders DateProperty for type=date', () => {
        const component = renderer.create(
            <RHSProperty
                field={makeField('date')}
                runID='run-1'
            />,
        );
        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'mock-date-property'})).toBeTruthy();
    });

    it('renders only the label row for an unknown type', () => {
        const component = renderer.create(
            <RHSProperty
                field={makeField('unknown')}
                runID='run-1'
            />,
        );
        const instance = component.root;
        const valueComponents = instance.findAll((n) =>
            ['mock-text-property', 'mock-select-property', 'mock-multiselect-property',
                'mock-user-property', 'mock-multiuser-property', 'mock-date-property'].includes(n.props['data-testid']),
        );
        expect(valueComponents.length).toBe(0);
    });
});
