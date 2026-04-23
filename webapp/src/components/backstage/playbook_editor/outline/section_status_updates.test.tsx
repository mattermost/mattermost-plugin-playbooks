// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {findNodeByTestId} from 'src/utils/test_helpers';

import StatusUpdates from './section_status_updates';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdatePlaybook = jest.fn().mockResolvedValue({});
jest.mock('src/graphql/hooks', () => ({
    useUpdatePlaybook: () => mockUpdatePlaybook,
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
        FormattedMessage: ({defaultMessage, values}: any) => {
            if (values?.duration) {
                const d = values.duration();
                const c = values.channels?.('0') ?? null;
                const w = values.webhooks?.('0') ?? null;
                return (
                    <div data-testid='status-text'>
                        <span data-testid='duration-slot'>{d}</span>
                        <span data-testid='channels-slot'>{c}</span>
                        <span data-testid='webhooks-slot'>{w}</span>
                    </div>
                );
            }
            return <span>{defaultMessage}</span>;
        },
    };
});

jest.mock('src/components/markdown_edit', () => ({
    __esModule: true,
    default: ({disabled}: {disabled?: boolean}) => (
        <div
            data-testid='markdown-edit'
            data-disabled={String(disabled)}
        />
    ),
}));

jest.mock('./inputs/broadcast_channels_selector', () => ({
    __esModule: true,
    default: ({children}: any) => <div data-testid='broadcast-channels'>{children}</div>,
}));

jest.mock('./inputs/update_timer_selector', () => ({
    __esModule: true,
    default: () => <div data-testid='update-timer'/>,
}));

jest.mock('./inputs/webhooks_input', () => ({
    __esModule: true,
    default: ({children}: any) => <div data-testid='webhooks-input'>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePlaybook = (overrides = {}) => ({
    id: 'pb-1',
    title: 'Test',
    team_id: 'team-1',
    delete_at: 0,
    status_update_enabled: true,
    reminder_timer_default_seconds: 86400,
    reminder_message_template: '',
    broadcast_enabled: true,
    broadcast_channel_ids: [],
    webhook_on_status_update_enabled: false,
    webhook_on_status_update_urls: [],
    ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatusUpdates', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders interactive UpdateTimer when disabled is false', () => {
        const component = renderer.create(
            <StatusUpdates
                playbook={makePlaybook() as any}
                disabled={false}
            />,
        );
        const tree = component.toJSON();
        const timer = findNodeByTestId(tree, 'update-timer');
        expect(timer).not.toBeNull();
    });

    it('renders read-only duration text when disabled is true', () => {
        const component = renderer.create(
            <StatusUpdates
                playbook={makePlaybook() as any}
                disabled={true}
            />,
        );
        const tree = component.toJSON();

        // When disabled, the duration slot renders formatted text, not the UpdateTimer picker
        const timer = findNodeByTestId(tree, 'update-timer');
        expect(timer).toBeNull();
    });

    it('passes disabled=true to MarkdownEdit when disabled', () => {
        const component = renderer.create(
            <StatusUpdates
                playbook={makePlaybook() as any}
                disabled={true}
            />,
        );
        const tree = component.toJSON();
        const mdEdit = findNodeByTestId(tree, 'markdown-edit');
        expect(mdEdit).not.toBeNull();
        expect(mdEdit.props['data-disabled']).toBe('true');
    });

    it('passes disabled=false to MarkdownEdit when enabled', () => {
        const component = renderer.create(
            <StatusUpdates
                playbook={makePlaybook() as any}
                disabled={false}
            />,
        );
        const tree = component.toJSON();
        const mdEdit = findNodeByTestId(tree, 'markdown-edit');
        expect(mdEdit).not.toBeNull();
        expect(mdEdit.props['data-disabled']).toBe('false');
    });
});
