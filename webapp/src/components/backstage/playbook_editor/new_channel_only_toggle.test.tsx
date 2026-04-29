// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import NewChannelOnlyToggle from './new_channel_only_toggle';

jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({
    Toggle: ({isChecked, onChange, disabled, children}: {isChecked: boolean; onChange: () => void; disabled?: boolean; children?: React.ReactNode}) => (
        <label>
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

const mockOpenModal = jest.fn();
jest.mock('src/components/widgets/confirmation_modal', () => ({
    useConfirmModal: () => mockOpenModal,
}));

const makePlaybook = (newChannelOnly: boolean) => ({
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
    channel_mode: 'create_new_channel',
    new_channel_only: newChannelOnly,
});

describe('NewChannelOnlyToggle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders toggle', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <NewChannelOnlyToggle
                playbook={playbook}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
    });

    it('toggle is checked when new_channel_only is true', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <NewChannelOnlyToggle
                playbook={playbook}
                onChange={onChange}
            />,
        );

        const input = component.root.findByProps({'data-testid': 'new-channel-only-toggle'}).findByType('input');
        expect(input.props.checked).toBe(true);
    });

    it('toggle is unchecked when new_channel_only is false', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <NewChannelOnlyToggle
                playbook={playbook}
                onChange={onChange}
            />,
        );

        const input = component.root.findByProps({'data-testid': 'new-channel-only-toggle'}).findByType('input');
        expect(input.props.checked).toBe(false);
    });

    it('opens confirmation modal when enabling (new_channel_only=false)', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <NewChannelOnlyToggle
                playbook={playbook}
                onChange={onChange}
            />,
        );
        const input = component.root.findByProps({'data-testid': 'new-channel-only-toggle'}).findByType('input');
        input.props.onChange();

        // Enabling opens a confirmation modal — onChange is NOT called yet
        expect(onChange).not.toHaveBeenCalled();
        expect(mockOpenModal).toHaveBeenCalledTimes(1);

        // Simulate confirming the modal
        const modalArg = mockOpenModal.mock.calls[0][0];
        modalArg.onConfirm();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({new_channel_only: true});
    });

    it('toggle calls onChange with new_channel_only: false when disabling', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <NewChannelOnlyToggle
                playbook={playbook}
                onChange={onChange}
            />,
        );
        const input = component.root.findByProps({'data-testid': 'new-channel-only-toggle'}).findByType('input');
        input.props.onChange();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({new_channel_only: false});
    });
});
