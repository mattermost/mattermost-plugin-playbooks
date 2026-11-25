// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {ToastStyle} from 'src/components/backstage/toast';
import {useSetRunPropertyValue} from 'src/graphql/hooks';
import manifest from 'src/manifest';
import {PropertyField} from 'src/types/properties';

import RHSProperty from './rhs_property';

const mockAddToast = jest.fn();
const textPropertyHarness: {onValueChange?: (value: string | null) => Promise<void>} = {};

jest.mock('src/graphql/hooks', () => ({
    useSetRunPropertyValue: jest.fn(() => [jest.fn().mockResolvedValue(undefined)]),
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: mockAddToast}),
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
    default: (props: {readOnly?: boolean; onValueChange?: (value: string | null) => Promise<void>}) => {
        textPropertyHarness.onValueChange = props.onValueChange;
        return (
            <div
                data-testid='mock-text-property'
                data-readonly={props.readOnly}
            />
        );
    },
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

    it('passes readOnly to property components', () => {
        const component = renderer.create(
            <RHSProperty
                field={makeField('text')}
                runID='run-1'
                readOnly={true}
            />,
        );
        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'mock-text-property'}).props['data-readonly']).toBe(true);
    });
});

describe('RHSProperty property value writes', () => {
    const originalFetch = global.fetch;
    const runID = 'run-1';
    const fieldID = 'field-1';
    let fetchMock: jest.Mock;

    const useRealWriteHook = () => {
        const actual = jest.requireActual('src/graphql/hooks') as {useSetRunPropertyValue: typeof useSetRunPropertyValue};
        (useSetRunPropertyValue as unknown as jest.Mock).mockImplementation(actual.useSetRunPropertyValue);
    };

    beforeEach(() => {
        useRealWriteHook();
        mockAddToast.mockClear();
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        (useSetRunPropertyValue as unknown as jest.Mock).mockReset();
        (useSetRunPropertyValue as unknown as jest.Mock).mockImplementation(() => [jest.fn().mockResolvedValue(undefined)]);
        global.fetch = originalFetch;
    });

    const renderTextProperty = () => {
        renderer.create(
            <RHSProperty
                field={makeField('text')}
                runID={runID}
            />,
        );
    };

    it('sends PUT /runs/{id}/property_fields/{fieldID}/value with {value}', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            headers: {get: () => 'application/json'},
            json: async () => ({field_id: fieldID, value: 'hello'}),
        });

        renderTextProperty();
        await textPropertyHarness.onValueChange?.('hello');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`/plugins/${manifest.id}/api/v0/runs/${runID}/property_fields/${fieldID}/value`);
        expect(options.method).toBe('PUT');
        expect(options.body).toBe(JSON.stringify({value: 'hello'}));
        expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('shows the failure toast when the property update request fails', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            headers: {get: () => 'application/json'},
            json: async () => ({error: 'nope'}),
        });

        renderTextProperty();
        await expect(textPropertyHarness.onValueChange?.('hello')).rejects.toThrow('Failed to update property value.');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`/plugins/${manifest.id}/api/v0/runs/${runID}/property_fields/${fieldID}/value`);
        expect(options.method).toBe('PUT');
        expect(options.body).toBe(JSON.stringify({value: 'hello'}));
        expect(mockAddToast).toHaveBeenCalledWith({
            content: 'Failed to update property value.',
            toastStyle: ToastStyle.Failure,
        });
    });
});
