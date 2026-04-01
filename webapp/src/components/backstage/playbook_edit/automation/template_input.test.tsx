// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {findNodeByTestId} from 'src/utils/test_helpers';

import {TemplateInput} from './template_input';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/components/backstage/playbook_edit/automation/styles', () => ({
    SelectorWrapper: ({children}: {children: React.ReactNode}) => <div data-testid='selector-wrapper'>{children}</div>,
}));

jest.mock('src/utils/template_utils', () => ({
    buildTemplatePreview: (template: string) => `preview:${template}`,
    SYSTEM_TOKENS: new Set(['SEQ', 'OWNER', 'CREATOR']),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Simulate typing into the input — fires onChange with the new value and cursor position.
const simulateInput = (component: renderer.ReactTestRenderer, value: string, cursorAt?: number) => {
    act(() => {
        const tree = component.toJSON();
        const inputNode = findNodeByTestId(tree, 'tpl-input');
        inputNode.props.onChange({
            target: {value, selectionStart: cursorAt ?? value.length},
        });
    });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TemplateInput', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the input with the provided value', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='Hello {SEQ}'
                onChange={onChange}
                fieldNames={[]}
                testId='tpl'
            />,
        );
        const tree = component.toJSON();
        const inputNode = findNodeByTestId(tree, 'tpl-input');

        expect(inputNode).not.toBeNull();
        expect(inputNode.props.value).toBe('Hello {SEQ}');
    });

    it('calls onChange when user types', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='Hello'
                onChange={onChange}
                fieldNames={[]}
                testId='tpl'
            />,
        );

        simulateInput(component, 'Hello World');

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('Hello World');
    });

    it('opens suggestion list when input contains an unmatched {', () => {
        const onChange = jest.fn();

        // Start with input that already has `{` — parent re-renders with this value
        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='Hello {'
                onChange={onChange}
                fieldNames={['Zone']}
                testId='tpl'
            />,
        );

        let tree = component.toJSON();

        // Suggestions hidden initially (no input change event yet)
        expect(findNodeByTestId(tree, 'tpl-suggestions').props.hidden).toBe(true);

        // Simulate the onChange that produced "Hello {"
        simulateInput(component, 'Hello {');

        tree = component.toJSON();

        // Now suggestions should appear (not hidden) with system tokens + field names
        const suggestions = findNodeByTestId(tree, 'tpl-suggestions');
        expect(suggestions).not.toBeNull();
        expect(suggestions.props.hidden).toBe(false);
        expect(findNodeByTestId(tree, 'tpl-suggestion-SEQ')).not.toBeNull();
        expect(findNodeByTestId(tree, 'tpl-suggestion-Zone')).not.toBeNull();
    });

    it('inserts selected token via mouseDown on suggestion', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='Hello {'
                onChange={onChange}
                fieldNames={[]}
                testId='tpl'
            />,
        );

        // Trigger suggestions by simulating onChange with "Hello {"
        simulateInput(component, 'Hello {');

        // Click the SEQ suggestion
        act(() => {
            const tree = component.toJSON();
            const seqItem = findNodeByTestId(tree, 'tpl-suggestion-SEQ');
            seqItem.props.onMouseDown({preventDefault: jest.fn()});
        });

        // Should insert {SEQ} replacing the `{` and partial query
        expect(onChange).toHaveBeenLastCalledWith('Hello {SEQ}');
    });

    it('filters suggestions as user types after {', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='{OW'
                onChange={onChange}
                fieldNames={['Zone']}
                testId='tpl'
            />,
        );

        // Simulate typing "{OW" — trigger is at position 0, query is "OW"
        simulateInput(component, '{OW');

        const tree = component.toJSON();

        // OWNER matches 'OW', SEQ and Zone don't
        expect(findNodeByTestId(tree, 'tpl-suggestion-OWNER')).not.toBeNull();
        expect(findNodeByTestId(tree, 'tpl-suggestion-SEQ')).toBeNull();
        expect(findNodeByTestId(tree, 'tpl-suggestion-Zone')).toBeNull();
    });

    it('closes suggestions when } is typed', () => {
        const onChange = jest.fn();

        // Start with partial "{SE" — trigger active
        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='{SE'
                onChange={onChange}
                fieldNames={[]}
                testId='tpl'
            />,
        );

        // Open suggestions
        simulateInput(component, '{SE');
        let tree = component.toJSON();
        expect(findNodeByTestId(tree, 'tpl-suggestions')).not.toBeNull();

        // Re-render with completed token and simulate the change
        act(() => {
            component.update(
                <TemplateInput
                    enabled={true}
                    placeholderText='Enter template'
                    input='{SEQ}'
                    onChange={onChange}
                    fieldNames={[]}
                    testId='tpl'
                />,
            );
        });
        simulateInput(component, '{SEQ}');

        tree = component.toJSON();
        expect(findNodeByTestId(tree, 'tpl-suggestions').props.hidden).toBe(true);
    });

    it('displays unknown field hint for unrecognised field IDs', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='{UnknownField}'
                onChange={onChange}
                fieldNames={[]}
                testId='tpl'
            />,
        );

        const tree = component.toJSON();
        const warningNode = findNodeByTestId(tree, 'tpl-warning');

        expect(warningNode).not.toBeNull();
        const json = JSON.stringify(warningNode);
        expect(json).toContain('UnknownField');
    });

    it('does not display warning when all field references are known', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='{SEQ} - Incident'
                onChange={onChange}
                fieldNames={[]}
                testId='tpl'
            />,
        );

        const tree = component.toJSON();
        const warningNode = findNodeByTestId(tree, 'tpl-warning');

        expect(warningNode).toBeNull();
    });

    it('closes suggestions when focus leaves the container', () => {
        jest.useFakeTimers();
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='Hello {'
                onChange={onChange}
                fieldNames={[]}
                testId='tpl'
            />,
        );

        // Open suggestions
        simulateInput(component, 'Hello {');

        let tree = component.toJSON();
        expect(findNodeByTestId(tree, 'tpl-suggestions')).not.toBeNull();

        // Trigger onBlur on the container
        act(() => {
            const containerNode = findNodeByTestId(tree, 'selector-wrapper');
            const inputContainer = Array.isArray(containerNode.children) ? containerNode.children[0] : null;
            if (inputContainer && inputContainer.props && inputContainer.props.onBlur) {
                inputContainer.props.onBlur();
            }
            jest.runAllTimers();
        });

        tree = component.toJSON();
        expect(findNodeByTestId(tree, 'tpl-suggestions').props.hidden).toBe(true);

        jest.useRealTimers();
    });
});
