// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {makeBasePlaybook} from 'src/utils/test_helpers';

import RetrospectiveToggle from './retrospective_toggle';

jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({
    Toggle: ({isChecked, onChange, disabled, children}: {isChecked: boolean; onChange: () => void; disabled?: boolean; children?: React.ReactNode}) => (
        <label
            data-testid='retrospective-toggle'
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

const makePlaybook = (retrospectiveEnabled: boolean) => makeBasePlaybook({
    retrospective_enabled: retrospectiveEnabled,
    retrospective_reminder_interval_seconds: 86400,
    retrospective_template: '',
});

describe('RetrospectiveToggle', () => {
    it('renders toggle with retrospective_enabled true', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <RetrospectiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        if (tree && !Array.isArray(tree)) {
            expect(tree.props['data-checked']).toBe(true);
        }
    });

    it('renders toggle with retrospective_enabled false', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <RetrospectiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        if (tree && !Array.isArray(tree)) {
            expect(tree.props['data-checked']).toBe(false);
        }
    });

    it('toggling off calls onChange with retrospective_enabled: false', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <RetrospectiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree) && tree.children) {
            const input = tree.children[0] as any;
            input.props.onChange();
        }

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({retrospective_enabled: false});
    });

    it('toggling on calls onChange with retrospective_enabled: true', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <RetrospectiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree) && tree.children) {
            const input = tree.children[0] as any;
            input.props.onChange();
        }

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({retrospective_enabled: true});
    });

    it('hides reminder interval when retrospective_enabled is false', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <RetrospectiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );

        const instance = component.root;
        const reminderIntervals = instance.findAll(
            (node) => node.props['data-testid'] === 'retrospective-reminder-interval',
        );
        expect(reminderIntervals.length).toBe(0);
    });

    it('shows reminder interval when retrospective_enabled is true', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <RetrospectiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );

        const instance = component.root;
        const reminderIntervals = instance.findAll(
            (node) => node.props['data-testid'] === 'retrospective-reminder-interval',
        );
        expect(reminderIntervals.length).toBeGreaterThan(0);
    });

    it('passes disabled prop to underlying Toggle', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <RetrospectiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={true}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree)) {
            expect(tree.props['data-disabled']).toBe(true);
        }
    });
});
