// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {makeBasePlaybook} from 'src/utils/test_helpers';

import AdminOnlyEditToggle from './admin_only_edit_toggle';

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
            data-testid='admin-only-edit-toggle'
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

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePlaybook = (adminOnlyEdit: boolean) => makeBasePlaybook({admin_only_edit: adminOnlyEdit});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminOnlyEditToggle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders toggle for admin users', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={playbook}
                isAdmin={true}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
    });

    it('toggle is checked when admin_only_edit is true', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={playbook}
                isAdmin={true}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree) && tree.children) {
            const label = tree.children[0] as any;
            expect(label.props['data-checked']).toBe(true);
        }
    });

    it('toggle is unchecked when admin_only_edit is false', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={playbook}
                isAdmin={true}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree) && tree.children) {
            const label = tree.children[0] as any;
            expect(label.props['data-checked']).toBe(false);
        }
    });

    it('dispatches confirmation modal when toggling on (admin_only_edit=false)', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={playbook}
                isAdmin={true}
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

        // Enabling opens a confirmation modal — onChange is NOT called yet
        expect(onChange).not.toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledTimes(1);

        // The modal should have an onConfirm that calls onChange with admin_only_edit: true
        const modalArg = mockOpenModal.mock.calls[0][0];
        expect(modalArg).toEqual({type: 'CONFIRM_MODAL', props: expect.objectContaining({show: true})});

        // Simulate confirming the modal
        modalArg.props.onConfirm();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({admin_only_edit: true});
    });

    it('calls onChange directly when toggling off (admin_only_edit=true)', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={playbook}
                isAdmin={true}
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

        // Disabling does NOT open a modal — calls onChange directly
        expect(mockOpenModal).not.toHaveBeenCalled();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({admin_only_edit: false});
    });

    it('does not render toggle for non-admin members', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={playbook}
                isAdmin={false}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeNull();
    });
});
