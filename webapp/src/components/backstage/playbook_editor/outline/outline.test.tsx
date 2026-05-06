// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {act} from 'react';
import renderer from 'react-test-renderer';

// Capture values passed to Actions on each render so tests can inspect them
// without coupling to DOM structure.
let capturedNewChannelOnly: boolean = false;
let capturedOnNewChannelOnlyChange: ((updated: {new_channel_only: boolean}) => void) | undefined;

jest.mock('./section_actions', () => ({
    __esModule: true,
    default: ({newChannelOnly, onNewChannelOnlyChange}: {newChannelOnly: boolean; onNewChannelOnlyChange: (u: {new_channel_only: boolean}) => void}) => {
        capturedNewChannelOnly = newChannelOnly;
        capturedOnNewChannelOnlyChange = onNewChannelOnlyChange;
        return null;
    },
}));

jest.mock('./section_status_updates', () => ({__esModule: true, default: () => null}));
jest.mock('./section_retrospective', () => ({__esModule: true, default: () => null}));
jest.mock('./scroll_nav', () => ({__esModule: true, default: () => null}));
jest.mock('./section', () => ({__esModule: true, default: ({children}: {children?: React.ReactNode}) => <>{children}</>}));

jest.mock('src/components/markdown_edit', () => ({__esModule: true, default: () => null}));
jest.mock('src/components/checklist/checklist_list', () => ({__esModule: true, default: () => null}));
jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({Toggle: () => null}));
jest.mock('src/components/playbook_actions_modal', () => ({__esModule: true, default: () => null}));

jest.mock('src/graphql/hooks', () => ({
    useUpdatePlaybook: jest.fn(() => jest.fn()),
}));

jest.mock('src/hooks', () => ({
    useAllowRetrospectiveAccess: jest.fn(() => false),
}));

jest.mock('src/client', () => ({
    savePlaybook: jest.fn(),
    clientFetchPlaybook: jest.fn(),
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: jest.fn()}),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    return {...reactIntl, useIntl: () => reactIntl.createIntl({locale: 'en'})};
});

const {savePlaybook, clientFetchPlaybook} = jest.requireMock('src/client');

import Outline from './outline';

// --- Helpers ---

const makePlaybook = (overrides: Record<string, unknown> = {}) => ({
    id: 'pb-1',
    delete_at: 0,
    run_summary_template_enabled: false,
    run_summary_template: '',
    status_update_enabled: false,
    retrospective_enabled: false,
    checklists: [],
    ...overrides,
} as any);

const makeRestPlaybook = (newChannelOnly: boolean, channelMode = 'create_new_channel') => ({
    id: 'pb-1',
    new_channel_only: newChannelOnly,
    channel_mode: channelMode,
    checklists: [],
} as any);

beforeEach(() => {
    jest.clearAllMocks();
    capturedNewChannelOnly = false;
    capturedOnNewChannelOnlyChange = undefined;
    clientFetchPlaybook.mockResolvedValue(makeRestPlaybook(false));
});

// --- Tests ---

describe('Outline — handleNewChannelOnlyChange', () => {
    it('passes restPlaybook.new_channel_only to Actions when no override is active', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(true)}
            />,
        );

        expect(capturedNewChannelOnly).toBe(true);
    });

    it('defaults to false when restPlaybook is absent', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
            />,
        );

        expect(capturedNewChannelOnly).toBe(false);
    });

    it('applies the optimistic override immediately — before the save resolves', () => {
        savePlaybook.mockReturnValue(new Promise(() => undefined));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        expect(capturedNewChannelOnly).toBe(false);

        act(() => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });

        expect(capturedNewChannelOnly).toBe(true);
    });

    it('calls savePlaybook with new_channel_only and channel_mode set to create_new_channel when toggling on', async () => {
        savePlaybook.mockResolvedValue({});
        clientFetchPlaybook.mockResolvedValue(makeRestPlaybook(false, 'link_existing_channel'));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false, 'link_existing_channel')}
            />,
        );

        await act(async () => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });

        expect(savePlaybook).toHaveBeenCalledTimes(1);
        expect(savePlaybook).toHaveBeenCalledWith(
            expect.objectContaining({new_channel_only: true, channel_mode: 'create_new_channel'}),
        );
    });

    it('preserves existing channel_mode when toggling off', async () => {
        savePlaybook.mockResolvedValue({});
        clientFetchPlaybook.mockResolvedValue(makeRestPlaybook(true, 'create_new_channel'));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(true, 'create_new_channel')}
            />,
        );

        await act(async () => {
            capturedOnNewChannelOnlyChange!({new_channel_only: false});
        });

        expect(savePlaybook).toHaveBeenCalledWith(
            expect.objectContaining({new_channel_only: false, channel_mode: 'create_new_channel'}),
        );
    });

    it('rolls back the optimistic override when savePlaybook rejects', async () => {
        savePlaybook.mockRejectedValue(new Error('network error'));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        act(() => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });
        expect(capturedNewChannelOnly).toBe(true);

        // eslint-disable-next-line no-empty-function
        await act(async () => {});

        expect(capturedNewChannelOnly).toBe(false);
    });

    it('does not call savePlaybook when the value did not change', async () => {
        savePlaybook.mockResolvedValue({});

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(true)}
            />,
        );

        await act(async () => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });

        expect(savePlaybook).not.toHaveBeenCalled();
    });

    it('does not call savePlaybook when the playbook is archived', async () => {
        renderer.create(
            <Outline
                playbook={makePlaybook({delete_at: 1})}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        await act(async () => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });

        expect(savePlaybook).not.toHaveBeenCalled();
        expect(capturedNewChannelOnly).toBe(false);
    });
});
