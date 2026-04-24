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

jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({
    Toggle: ({isChecked, onChange, children}: {isChecked: boolean; onChange: () => void; children?: React.ReactNode}) => (
        <label
            data-testid='admin-only-edit-toggle'
            data-checked={isChecked}
        >
            <input
                type='checkbox'
                checked={isChecked}
                onChange={onChange}
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
    it('renders toggle', () => {
        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={makePlaybook(false)}
                onChange={jest.fn()}
            />,
        );
        expect(component.toJSON()).toBeTruthy();
    });

    it('toggle is checked when admin_only_edit is true', () => {
        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={makePlaybook(true)}
                onChange={jest.fn()}
            />,
        );
        const tree = component.toJSON() as any;
        expect(tree.children[0].props['data-checked']).toBe(true);
    });

    it('toggle is unchecked when admin_only_edit is false', () => {
        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={makePlaybook(false)}
                onChange={jest.fn()}
            />,
        );
        const tree = component.toJSON() as any;
        expect(tree.children[0].props['data-checked']).toBe(false);
    });

    it('calls onChange with admin_only_edit: true when toggling on', () => {
        const onChange = jest.fn();
        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={makePlaybook(false)}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON() as any;
        act(() => {
            tree.children[0].children[0].props.onChange();
        });
        expect(onChange).toHaveBeenCalledWith({admin_only_edit: true});
    });

    it('calls onChange with admin_only_edit: false when toggling off', () => {
        const onChange = jest.fn();
        const component = renderer.create(
            <AdminOnlyEditToggle
                playbook={makePlaybook(true)}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON() as any;
        act(() => {
            tree.children[0].children[0].props.onChange();
        });
        expect(onChange).toHaveBeenCalledWith({admin_only_edit: false});
    });
});
