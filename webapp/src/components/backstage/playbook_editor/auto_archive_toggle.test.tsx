// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {makeBasePlaybook} from 'src/utils/test_helpers';

import AutoArchiveToggle from './auto_archive_toggle';

jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({
    Toggle: ({isChecked, onChange, disabled, children}: {isChecked: boolean; onChange: () => void; disabled?: boolean; children?: React.ReactNode}) => (
        <label
            data-testid='auto-archive-toggle'
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

jest.mock('src/components/widgets/tooltip', () => ({
    __esModule: true,
    default: ({children, content}: any) => (
        <div data-tooltip={content}>{children}</div>
    ),
}));

const makePlaybook = (autoArchiveChannel: boolean, channelMode = 'create_new_channel') =>
    makeBasePlaybook({auto_archive_channel: autoArchiveChannel, channel_mode: channelMode});

describe('AutoArchiveToggle', () => {
    it('renders toggle with auto_archive_channel=false', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <AutoArchiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );
        const tree = component.toJSON();

        // tree is the label element (the Toggle mock)
        expect(tree).not.toBeNull();
        expect((tree as any)?.props?.['data-checked']).toBe(false);
    });

    it('renders toggle with auto_archive_channel=true', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <AutoArchiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        if (tree && !Array.isArray(tree) && tree.children) {
            const label = tree.children[0] as any;
            expect(label.props['data-checked']).toBe(true);
        }
    });

    it('toggling on calls onChange with auto_archive_channel: true', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <AutoArchiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );
        const tree = component.toJSON();

        // tree is the label element (the Toggle mock)
        // tree.children[0] is the input element
        expect(tree).not.toBeNull();
        const label = tree as any;
        const input = label?.children?.[0] as any;
        input?.props?.onChange?.();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({
            auto_archive_channel: true,
        });
    });

    it('toggling off calls onChange with auto_archive_channel: false', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <AutoArchiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );
        const tree = component.toJSON();

        expect(tree).not.toBeNull();
        if (Array.isArray(tree)) {
            const label = tree[0] as any;
            const input = label.children[0] as any;
            input.props.onChange();
        }

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({
            auto_archive_channel: false,
        });
    });

    it('shows confirmation banner when auto_archive_channel is true', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(true);

        const component = renderer.create(
            <AutoArchiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );

        const instance = component.root;
        const banners = instance.findAll(
            (node) => node.props['data-testid'] === 'auto-archive-confirmation-banner',
        );
        expect(banners.length).toBeGreaterThan(0);
    });

    it('does not show confirmation banner when auto_archive_channel is false', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <AutoArchiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );

        const instance = component.root;
        const banners = instance.findAll(
            (node) => node.props['data-testid'] === 'auto-archive-confirmation-banner',
        );
        expect(banners.length).toBe(0);
    });

    it('is disabled when channel mode is link_existing_channel', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false, 'link_existing_channel');

        const component = renderer.create(
            <AutoArchiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );

        const instance = component.root;
        const toggles = instance.findAll(
            (node) => node.props['data-testid'] === 'auto-archive-toggle',
        );
        expect(toggles.length).toBeGreaterThan(0);
        expect(toggles[0].props['data-disabled']).toBe(true);
    });

    it('is enabled when channel mode is create_new_channel', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false, 'create_new_channel');

        const component = renderer.create(
            <AutoArchiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={false}
            />,
        );

        const instance = component.root;
        const toggles = instance.findAll(
            (node) => node.props['data-testid'] === 'auto-archive-toggle',
        );
        expect(toggles.length).toBeGreaterThan(0);
        expect(toggles[0].props['data-disabled']).toBe(false);
    });

    it('passes disabled prop to underlying Toggle', () => {
        const onChange = jest.fn();
        const playbook = makePlaybook(false);

        const component = renderer.create(
            <AutoArchiveToggle
                playbook={playbook}
                onChange={onChange}
                disabled={true}
            />,
        );
        const tree = component.toJSON();

        // tree is the label element (the Toggle mock)
        expect(tree).not.toBeNull();
        expect((tree as any)?.props?.['data-disabled']).toBe(true);
    });
});
