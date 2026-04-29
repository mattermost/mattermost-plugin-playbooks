// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {act} from 'react';
import renderer from 'react-test-renderer';

// Capture values passed to Actions on each render so tests can inspect them
// without coupling to DOM structure.
let capturedAutoArchiveChannel: boolean = false;
let capturedOnAutoArchiveChange: ((updated: {auto_archive_channel: boolean}) => void) | undefined;

jest.mock('./section_actions', () => ({
    __esModule: true,
    default: ({autoArchiveChannel, onAutoArchiveChange}: {autoArchiveChannel: boolean; onAutoArchiveChange: (u: {auto_archive_channel: boolean}) => void}) => {
        capturedAutoArchiveChannel = autoArchiveChannel;
        capturedOnAutoArchiveChange = onAutoArchiveChange;
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
    useAllowRetrospectiveAccess: jest.fn(() => false),
}));

jest.mock('src/hooks', () => ({
    useAllowRetrospectiveAccess: jest.fn(() => false),
}));

jest.mock('src/client', () => ({
    savePlaybook: jest.fn(),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

const {savePlaybook} = jest.requireMock('src/client');

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

const makeRestPlaybook = (autoArchive: boolean) => ({
    id: 'pb-1',
    auto_archive_channel: autoArchive,
    channel_mode: 'create_new_channel',
    checklists: [],
} as any);

beforeEach(() => {
    jest.clearAllMocks();
    capturedAutoArchiveChannel = false;
    capturedOnAutoArchiveChange = undefined;
});

// --- Tests ---

describe('Outline — auto-archive optimistic state', () => {
    it('passes restPlaybook.auto_archive_channel to Actions when no override is active', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(true)}
            />,
        );

        expect(capturedAutoArchiveChannel).toBe(true);
    });

    it('defaults to false when restPlaybook is absent', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
            />,
        );

        expect(capturedAutoArchiveChannel).toBe(false);
    });

    it('applies the optimistic override immediately on toggle — before the save resolves', () => {
        // savePlaybook never resolves so we can observe the mid-flight state
        savePlaybook.mockReturnValue(new Promise(() => undefined));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        expect(capturedAutoArchiveChannel).toBe(false);

        act(() => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
        });

        expect(capturedAutoArchiveChannel).toBe(true);
    });

    it('calls refetch after savePlaybook resolves successfully', async () => {
        const refetch = jest.fn();
        savePlaybook.mockResolvedValue({});

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={refetch}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        await act(async () => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
            await Promise.resolve();
        });

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('rolls back the optimistic override to the previous value when savePlaybook rejects', async () => {
        savePlaybook.mockRejectedValue(new Error('network error'));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        // Optimistic update: override jumps to true
        act(() => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
        });
        expect(capturedAutoArchiveChannel).toBe(true);

        // After rejection, override resets to previous value (false)
        await act(async () => {
            await Promise.resolve();
        });

        expect(capturedAutoArchiveChannel).toBe(false);
    });

    it('does not call savePlaybook when the playbook is archived', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook({delete_at: 1})}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        act(() => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
        });

        expect(savePlaybook).not.toHaveBeenCalled();
        expect(capturedAutoArchiveChannel).toBe(false);
    });

    it('clears the optimistic override once the server state catches up to it', () => {
        // savePlaybook never resolves — we control the restPlaybook prop instead
        savePlaybook.mockReturnValue(new Promise(() => undefined));

        let component!: renderer.ReactTestRenderer;

        act(() => {
            component = renderer.create(
                <Outline
                    playbook={makePlaybook()}
                    refetch={jest.fn()}
                    restPlaybook={makeRestPlaybook(false)}
                />,
            );
        });

        // Apply optimistic override: true
        act(() => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
        });
        expect(capturedAutoArchiveChannel).toBe(true);

        // Simulate the server catching up: re-render with updated restPlaybook
        act(() => {
            component.update(
                <Outline
                    playbook={makePlaybook()}
                    refetch={jest.fn()}
                    restPlaybook={makeRestPlaybook(true)}
                />,
            );
        });

        // Override is cleared; effectiveAutoArchive is now driven by restPlaybook
        expect(capturedAutoArchiveChannel).toBe(true);
    });
});
