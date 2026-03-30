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

// ReactSelect is heavy and relies on the browser DOM — replace with a minimal stub
// that exposes the onChange handler so tests can simulate token selection.
jest.mock('react-select', () => ({
    __esModule: true,
    default: ({onChange}: {onChange: (option: any) => void}) => (
        <div data-testid='token-dropdown'>
            <button
                data-testid='select-seq-token'
                onClick={() => onChange({value: 'SEQ', label: '{SEQ} — Sequential ID', isSystem: true})}
            >
                {'SEQ'}
            </button>
        </div>
    ),
}));

// SelectorWrapper is a plain styled div — mock to avoid styled-components issues
jest.mock('src/components/backstage/playbook_edit/automation/styles', () => ({
    SelectorWrapper: ({children}: {children: React.ReactNode}) => <div data-testid='selector-wrapper'>{children}</div>,
}));

jest.mock('src/utils/template_utils', () => ({
    buildTemplatePreview: (template: string) => `preview:${template}`,
    SYSTEM_TOKENS: new Set(['SEQ', 'OWNER', 'CREATOR']),
}));

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
                testId='run-name-template'
            />,
        );
        const tree = component.toJSON();
        const inputNode = findNodeByTestId(tree, 'run-name-template-input');

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
                testId='run-name-template'
            />,
        );
        const tree = component.toJSON();
        const inputNode = findNodeByTestId(tree, 'run-name-template-input');

        act(() => {
            inputNode.props.onChange({target: {value: 'Hello World'}});
        });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('Hello World');
    });

    it('opens token dropdown when "{" is typed', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='Hello'
                onChange={onChange}
                fieldNames={[]}
                testId='run-name-template'
            />,
        );

        let tree = component.toJSON();

        // Dropdown should not be visible initially
        expect(findNodeByTestId(tree, 'token-dropdown')).toBeNull();

        act(() => {
            const inputNode = findNodeByTestId(tree, 'run-name-template-input');
            inputNode.props.onKeyDown({
                key: '{',
                currentTarget: {selectionStart: 5},
            });
        });

        tree = component.toJSON();
        expect(findNodeByTestId(tree, 'token-dropdown')).not.toBeNull();
    });

    it('inserts selected token at cursor position', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='Hello '
                onChange={onChange}
                fieldNames={[]}
                testId='run-name-template'
            />,
        );

        // Open the dropdown by typing "{"
        act(() => {
            const tree = component.toJSON();
            const inputNode = findNodeByTestId(tree, 'run-name-template-input');

            // Simulate cursor at position 6 (end of 'Hello ')
            inputNode.props.onKeyDown({
                key: '{',
                currentTarget: {selectionStart: 6},
            });
        });

        // Select the SEQ token from the dropdown stub
        act(() => {
            const tree = component.toJSON();
            const seqButton = findNodeByTestId(tree, 'select-seq-token');
            seqButton.props.onClick();
        });

        // The token is inserted at cursorPos=6; 'Hello ' + '{SEQ}' + '' (skip the '{' at pos 6)
        expect(onChange).toHaveBeenCalledWith('Hello {SEQ}');
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
                testId='run-name-template'
            />,
        );

        const tree = component.toJSON();
        const warningNode = findNodeByTestId(tree, 'run-name-template-warning');

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
                testId='run-name-template'
            />,
        );

        const tree = component.toJSON();
        const warningNode = findNodeByTestId(tree, 'run-name-template-warning');

        expect(warningNode).toBeNull();
    });

    it('handleKeyDown: closes dropdown when focus leaves the container', () => {
        jest.useFakeTimers();
        const onChange = jest.fn();

        const component = renderer.create(
            <TemplateInput
                enabled={true}
                placeholderText='Enter template'
                input='Hello'
                onChange={onChange}
                fieldNames={[]}
                testId='run-name-template'
            />,
        );

        // Open the dropdown
        act(() => {
            const tree = component.toJSON();
            const inputNode = findNodeByTestId(tree, 'run-name-template-input');
            inputNode.props.onKeyDown({
                key: '{',
                currentTarget: {selectionStart: 5},
            });
        });

        let tree = component.toJSON();
        expect(findNodeByTestId(tree, 'token-dropdown')).not.toBeNull();

        // Trigger onBlur on the container — simulates focus leaving to an external element.
        // Since document.activeElement won't be inside the container in jsdom,
        // the setTimeout callback will call setShowDropdown(false).
        act(() => {
            const containerNode = findNodeByTestId(tree, 'selector-wrapper');

            // Walk up to find the InputContainer div (direct child of SelectorWrapper)
            // The tree structure is: selector-wrapper > InputContainer > ...
            // InputContainer is the first child array element
            const inputContainer = Array.isArray(containerNode.children) ? containerNode.children[0] : null;
            if (inputContainer && inputContainer.props && inputContainer.props.onBlur) {
                inputContainer.props.onBlur();
            }
            jest.runAllTimers();
        });

        tree = component.toJSON();
        expect(findNodeByTestId(tree, 'token-dropdown')).toBeNull();

        jest.useRealTimers();
    });
});
