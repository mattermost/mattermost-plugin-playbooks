// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

jest.mock('src/components/widgets/generic_modal', () => {
    const ReactImpl = jest.requireActual('react');
    const MockGenericModal = (props: {children: React.ReactNode}) => ReactImpl.createElement('div', {'data-testid': 'mock-generic-modal'}, props.children);
    return {
        __esModule: true,
        default: MockGenericModal,
    };
});

import ExportOptionsModal, {SectionFlags, Surface} from './export_options_modal';

const wrap = (ui: React.ReactNode) => (
    <IntlProvider
        locale='en'
        messages={{}}
    >
        {ui}
    </IntlProvider>
);

const findCheckboxes = (instance: renderer.ReactTestInstance) =>
    instance.findAllByType('input').filter((n) => n.props.type === 'checkbox');

const render = (overrides: Partial<{surface: Surface; defaults: SectionFlags; channelExportAvailable: boolean}> = {}) => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(wrap(
            <ExportOptionsModal
                surface={overrides.surface ?? 'run'}
                defaults={overrides.defaults ?? {}}
                onConfirm={onConfirm}
                onCancel={onCancel}
                channelExportAvailable={overrides.channelExportAvailable}
            />,
        ));
    });
    return {tree, onConfirm, onCancel};
};

describe('ExportOptionsModal', () => {
    it('renders 7 toggles for run surface with transcript off by default', () => {
        const {tree} = render({surface: 'run'});
        const checkboxes = findCheckboxes(tree.root);
        expect(checkboxes).toHaveLength(7);
        const transcript = tree.root.findByProps({'data-testid': 'section-toggle-transcript'});
        expect(transcript.findByType('input').props.checked).toBe(false);
        const cover = tree.root.findByProps({'data-testid': 'section-toggle-cover'});
        expect(cover.findByType('input').props.checked).toBe(true);
    });

    it('renders 3 toggles for playbook surface', () => {
        const {tree} = render({surface: 'playbook'});
        const checkboxes = findCheckboxes(tree.root);
        expect(checkboxes).toHaveLength(3);
    });

    it('toggling a section flips its checked state', () => {
        const {tree} = render({surface: 'run'});
        const transcript = tree.root.findByProps({'data-testid': 'section-toggle-transcript'});
        const input = transcript.findByType('input');
        expect(input.props.checked).toBe(false);
        act(() => {
            input.props.onChange();
        });
        const updated = tree.root.findByProps({'data-testid': 'section-toggle-transcript'}).findByType('input');
        expect(updated.props.checked).toBe(true);
    });

    it('hides channel-export hint when unavailable', () => {
        const {tree} = render({surface: 'run', channelExportAvailable: false});
        expect(tree.root.findAllByProps({'data-testid': 'channel-export-hint'})).toHaveLength(0);
    });

    it('shows channel-export hint when available on run surface', () => {
        const {tree} = render({surface: 'run', channelExportAvailable: true});
        expect(tree.root.findAllByProps({'data-testid': 'channel-export-hint'}).length).toBeGreaterThan(0);
    });

    it('does not show channel-export hint on playbook surface', () => {
        const {tree} = render({surface: 'playbook', channelExportAvailable: true});
        expect(tree.root.findAllByProps({'data-testid': 'channel-export-hint'})).toHaveLength(0);
    });

    it('matches snapshot for run surface', () => {
        const {tree} = render({surface: 'run'});
        expect(tree.toJSON()).toMatchSnapshot();
    });

    it('matches snapshot for playbook surface', () => {
        const {tree} = render({surface: 'playbook'});
        expect(tree.toJSON()).toMatchSnapshot();
    });
});
