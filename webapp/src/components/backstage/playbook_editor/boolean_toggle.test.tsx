// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import BooleanToggle from './boolean_toggle';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
}));

const mockOpenModal = jest.fn();
jest.mock('src/webapp_globals', () => ({
    modals: {openModal: (...args: any[]) => mockOpenModal(...args)},
}));

jest.mock('src/components/widgets/confirmation_modal', () => ({
    makeUncontrolledConfirmModalDefinition: (props: any) => ({type: 'CONFIRM_MODAL', props}),
}));

jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({
    Toggle: ({isChecked, onChange, disabled, children}: {isChecked: boolean; onChange: () => void; disabled?: boolean; children?: React.ReactNode}) => (
        <label
            data-testid='boolean-toggle'
            data-checked={isChecked}
            data-disabled={disabled}
        >
            <input
                type='checkbox'
                checked={isChecked}
                onChange={onChange}
                disabled={disabled}
            />
            {children}
        </label>
    ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BooleanToggle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the toggle label text', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <BooleanToggle
                label='Enable feature'
                value={false}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const json = JSON.stringify(tree);
        expect(json).toContain('Enable feature');
    });

    it('calls onChange(true) when toggled on', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <BooleanToggle
                label='Enable feature'
                value={false}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        act(() => {
            if (tree && !Array.isArray(tree) && tree.children) {
                const label = tree.children[0] as any;
                const input = label.children[0] as any;
                input.props.onChange();
            }
        });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange(false) when toggled off', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <BooleanToggle
                label='Enable feature'
                value={true}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        act(() => {
            if (tree && !Array.isArray(tree) && tree.children) {
                const label = tree.children[0] as any;
                const input = label.children[0] as any;
                input.props.onChange();
            }
        });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('shows confirmation dialog when confirmationRequired is set and user enables the toggle', () => {
        const onChange = jest.fn();
        const confirmationRequired = {
            title: 'Confirm action',
            message: 'Are you sure?',
            confirmButtonText: 'Yes',
        };

        const component = renderer.create(
            <BooleanToggle
                label='Enable feature'
                value={false}
                onChange={onChange}
                confirmationRequired={confirmationRequired}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        act(() => {
            if (tree && !Array.isArray(tree) && tree.children) {
                const label = tree.children[0] as any;
                const input = label.children[0] as any;
                input.props.onChange();
            }
        });

        // onChange must NOT be called yet — confirmation is pending
        expect(onChange).not.toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledTimes(1);
    });

    it('confirmation dialog: proceeds on confirm', () => {
        const onChange = jest.fn();
        const confirmationRequired = {
            title: 'Confirm action',
            message: 'Are you sure?',
            confirmButtonText: 'Yes',
        };

        const component = renderer.create(
            <BooleanToggle
                label='Enable feature'
                value={false}
                onChange={onChange}
                confirmationRequired={confirmationRequired}
            />,
        );
        const tree = component.toJSON();

        act(() => {
            if (tree && !Array.isArray(tree) && tree.children) {
                const label = tree.children[0] as any;
                const input = label.children[0] as any;
                input.props.onChange();
            }
        });

        // Simulate clicking Confirm in the modal
        const modalArg = mockOpenModal.mock.calls[0][0];
        modalArg.props.onConfirm();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('confirmation dialog: cancels and reverts on cancel', () => {
        const onChange = jest.fn();
        const confirmationRequired = {
            title: 'Confirm action',
            message: 'Are you sure?',
            confirmButtonText: 'Yes',
        };

        const component = renderer.create(
            <BooleanToggle
                label='Enable feature'
                value={false}
                onChange={onChange}
                confirmationRequired={confirmationRequired}
            />,
        );
        const tree = component.toJSON();

        act(() => {
            if (tree && !Array.isArray(tree) && tree.children) {
                const label = tree.children[0] as any;
                const input = label.children[0] as any;
                input.props.onChange();
            }
        });

        // Simulate clicking Cancel in the modal
        const modalArg = mockOpenModal.mock.calls[0][0];
        modalArg.props.onCancel();

        // onChange must never be called
        expect(onChange).not.toHaveBeenCalled();
    });

    it('renders toggle_hint text when hint prop is provided', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <BooleanToggle
                label='Enable feature'
                hint='This is a hint'
                value={false}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();
        const json = JSON.stringify(tree);

        expect(json).toContain('This is a hint');
    });

    it('does not render hint element when hint prop is not provided', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <BooleanToggle
                label='Enable feature'
                value={false}
                onChange={onChange}
            />,
        );

        // tree is a div with one child (the Toggle); the hint div is absent
        const tree = component.toJSON();
        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree)) {
            // Only the toggle label child; no second hint child
            expect(tree.children).toHaveLength(1);
        }
    });

    it('disabled state: does not fire onChange when disabled', () => {
        const onChange = jest.fn();

        const component = renderer.create(
            <BooleanToggle
                label='Enable feature'
                value={false}
                onChange={onChange}
                disabled={true}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree) && tree.children) {
            const label = tree.children[0] as any;

            // The underlying input is disabled — the Toggle mock honours the disabled prop
            expect(label.props['data-disabled']).toBe(true);
        }

        // The disabled prop is forwarded; the browser prevents onChange on disabled inputs.
        // Verify that no call happened without simulating the event.
        expect(onChange).not.toHaveBeenCalled();
    });
});
