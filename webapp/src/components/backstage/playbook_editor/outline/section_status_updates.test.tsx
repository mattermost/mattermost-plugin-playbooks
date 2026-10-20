// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import StatusUpdates from './section_status_updates';

const renderWithIntl = (element: React.ReactElement) => renderer.create(
    <IntlProvider locale='en'>{element}</IntlProvider>,
);

jest.mock('src/graphql/hooks', () => ({
    useUpdatePlaybook: () => jest.fn(),
}));

jest.mock('src/components/markdown_edit', () => ({
    __esModule: true,
    default: () => <div data-testid='markdown-edit'/>,
}));

jest.mock('./inputs/update_timer_selector', () => ({
    __esModule: true,
    default: () => <div data-testid='update-timer-selector'/>,
}));

jest.mock('./inputs/broadcast_channels_selector', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <div data-testid='broadcast-channels'>{children}</div>,
}));

jest.mock('./inputs/webhooks_input', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <div data-testid='webhooks-input'>{children}</div>,
}));

const makePlaybook = (overrides: Record<string, unknown> = {}): any => ({
    id: 'playbook-1',
    status_update_enabled: true,
    reminder_timer_default_seconds: 24 * 60 * 60,
    reminder_message_template: '',
    broadcast_enabled: false,
    broadcast_channel_ids: [],
    webhook_on_status_update_enabled: false,
    webhook_on_status_update_urls: [],
    delete_at: 0,
    ...overrides,
});

describe('StatusUpdates section', () => {
    it('shows the not-expected placeholder when status updates are disabled', () => {
        const treeStr = JSON.stringify(renderWithIntl(
            <StatusUpdates playbook={makePlaybook({status_update_enabled: false})}/>,
        ).toJSON());

        expect(treeStr).toContain('Status updates are not expected.');
        expect(treeStr).not.toContain('update-timer-selector');
    });

    it('uses the "expected every" phrasing when a positive reminder is set', () => {
        const treeStr = JSON.stringify(renderWithIntl(
            <StatusUpdates playbook={makePlaybook({reminder_timer_default_seconds: 24 * 60 * 60})}/>,
        ).toJSON());

        expect(treeStr).toContain('every');
        expect(treeStr).toContain('update-timer-selector');
    });

    it('uses the "never expected" phrasing (no "every") when the reminder is 0', () => {
        const treeStr = JSON.stringify(renderWithIntl(
            <StatusUpdates playbook={makePlaybook({reminder_timer_default_seconds: 0})}/>,
        ).toJSON());

        expect(treeStr).not.toContain('every');
        expect(treeStr).toContain('update-timer-selector');
    });

    it('renders the literal "never" instead of the picker when read-only with no reminder', () => {
        const treeStr = JSON.stringify(renderWithIntl(
            <StatusUpdates
                playbook={makePlaybook({reminder_timer_default_seconds: 0})}
                canEdit={false}
            />,
        ).toJSON());

        expect(treeStr).toContain('never');
        expect(treeStr).not.toContain('every');
        expect(treeStr).not.toContain('update-timer-selector');
    });
});
