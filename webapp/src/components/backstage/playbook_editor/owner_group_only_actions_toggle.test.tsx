// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {modals} from 'src/webapp_globals';

import OwnerGroupOnlyActionsToggle from './owner_group_only_actions_toggle';

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
}));

jest.mock('src/webapp_globals', () => ({
    modals: {openModal: jest.fn()},
}));

jest.mock('src/components/widgets/confirmation_modal', () => ({
    makeUncontrolledConfirmModalDefinition: (props: any) => ({type: 'CONFIRM_MODAL', props}),
    useConfirmModal: () => (options: any) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
        const {modals: m} = require('src/webapp_globals');
        m.openModal({type: 'CONFIRM_MODAL', props: options});
    },
}));

jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({
    Toggle: ({isChecked, onChange, disabled, children}: {isChecked: boolean; onChange: () => void; disabled?: boolean; children?: React.ReactNode}) => (
        <label
            data-testid='owner-group-only-actions-toggle'
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

const makePlaybook = (ownerGroupOnlyActions: boolean) => ({
    id: 'playbook-1',
    title: 'Test Playbook',
    description: '',
    team_id: 'team-1',
    public: true,
    create_public_playbook_run: false,
    delete_at: 0,
    num_stages: 0,
    num_steps: 0,
    num_runs: 0,
    num_actions: 0,
    last_run_at: 0,
    members: [],
    default_playbook_member_role: '',
    active_runs: 0,
    default_owner_id: '',
    default_owner_enabled: false,
    run_summary_template_enabled: false,
    owner_group_only_actions: ownerGroupOnlyActions,
});

describe('OwnerGroupOnlyActionsToggle', () => {
    it('renders toggle for admin users', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <OwnerGroupOnlyActionsToggle
                playbook={playbook}
                isPlaybookAdmin={true}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
    });

    it('toggle is checked when owner_group_only_actions is true', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <OwnerGroupOnlyActionsToggle
                playbook={playbook}
                isPlaybookAdmin={true}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        // Component wraps Toggle in a <div>, so tree.children[0] is the label (Toggle mock)
        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree) && tree.children) {
            const label = tree.children[0] as any;
            expect(label.props['data-checked']).toBe(true);
        }
    });

    it('toggle is unchecked when owner_group_only_actions is false', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <OwnerGroupOnlyActionsToggle
                playbook={playbook}
                isPlaybookAdmin={true}
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

    it('toggle calls onChange with owner_group_only_actions: true when enabling', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <OwnerGroupOnlyActionsToggle
                playbook={playbook}
                isPlaybookAdmin={true}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        // tree -> div -> children[0] = label (Toggle mock) -> children[0] = input
        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree) && tree.children) {
            const label = tree.children[0] as any;
            const input = label.children[0] as any;
            input.props.onChange();
        }

        // Enabling (false→true) triggers a confirmation modal via BooleanToggle's confirmationRequired.
        // onChange is only called after the user confirms; simulate that here.
        const openModalCall = (modals.openModal as jest.Mock).mock.calls[0][0];
        openModalCall.props.onConfirm();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({owner_group_only_actions: true});
    });

    it('toggle calls onChange with owner_group_only_actions: false when disabling', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <OwnerGroupOnlyActionsToggle
                playbook={playbook}
                isPlaybookAdmin={true}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree) && tree.children) {
            const label = tree.children[0] as any;
            const input = label.children[0] as any;
            input.props.onChange();
        }

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({owner_group_only_actions: false});
    });

    it('does not render for non-admin members', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <OwnerGroupOnlyActionsToggle
                playbook={playbook}
                isPlaybookAdmin={false}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeNull();
    });
});
