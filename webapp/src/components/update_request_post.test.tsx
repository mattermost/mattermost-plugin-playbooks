// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {Post} from '@mattermost/types/posts';

import UpdateRequestPost from './update_request_post';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', defaultLocale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => jest.fn(),

    // Channel and team reads both need an id. Returning one object keeps the
    // post mounted without a Redux store.
    useAppSelector: () => ({id: 'team-1', team_id: 'team-1', name: 'team'}),
}));

jest.mock('src/components/post_text', () => ({text}: {text: string}) => (
    <div>{text}</div>
));

jest.mock('src/hooks', () => ({
    useClientRect: () => [null, jest.fn()],
}));

const mockFetchPlaybookRun = jest.fn();
const mockFetchPlaybookRuns = jest.fn();
jest.mock('src/client', () => ({
    fetchPlaybookRun: (...args: unknown[]) => mockFetchPlaybookRun(...args),
    fetchPlaybookRuns: (...args: unknown[]) => mockFetchPlaybookRuns(...args),
    resetReminder: jest.fn(),
}));

type ReminderRun = {
    id: string;
    name: string;
    previous_reminder: number;
    reminder_timer_default_seconds: number;
};

const reminderRun = (id: string, name: string): ReminderRun => ({
    id,
    name,
    previous_reminder: 0,
    reminder_timer_default_seconds: 0,
});

function deferred<T>() {
    let resolve: (value: T) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {
        promise,
        resolve: (value: T) => resolve(value),
        reject: (reason?: unknown) => reject(reason),
    };
}

const originalMessage = 'Original reminder for Alpha.';

const makePost = (props: Record<string, unknown> = {}): Post => ({
    id: 'post-1',
    message: originalMessage,
    channel_id: 'channel-1',
    props,
} as Post);

describe('UpdateRequestPost fetch', () => {
    beforeEach(() => {
        mockFetchPlaybookRun.mockReset();
        mockFetchPlaybookRuns.mockReset();
    });

    it('drops a run response after the run id changes', async () => {
        const first = deferred<ReminderRun>();
        const second = deferred<ReminderRun>();
        mockFetchPlaybookRun.mockImplementationOnce(() => first.promise);
        mockFetchPlaybookRun.mockImplementationOnce(() => second.promise);

        let tree: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(
                <UpdateRequestPost post={makePost({playbookRunId: 'run-1', targetUsername: 'ada'})}/>,
            );
        });
        await act(async () => {
            tree!.update(
                <UpdateRequestPost post={makePost({playbookRunId: 'run-2', targetUsername: 'ada'})}/>,
            );
        });
        await act(async () => {
            first.resolve(reminderRun('run-1', 'Stale run'));
            second.resolve(reminderRun('run-2', 'Fresh run'));
            await first.promise;
            await second.promise;
        });

        const json = JSON.stringify(tree!.toJSON());
        expect(json).toContain('Fresh run');
        expect(json).not.toContain('Stale run');
    });

    it('drops a run response after unmount', async () => {
        const pending = deferred<ReminderRun>();
        mockFetchPlaybookRun.mockReturnValue(pending.promise);

        let tree: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(
                <UpdateRequestPost post={makePost({playbookRunId: 'run-1', targetUsername: 'ada'})}/>,
            );
        });
        tree!.unmount();

        await act(async () => {
            pending.resolve(reminderRun('run-1', 'Late run'));
            await pending.promise;
        });

        expect(mockFetchPlaybookRun).toHaveBeenCalledTimes(1);
    });

    it('shows the original post when the run fetch fails', async () => {
        mockFetchPlaybookRun.mockRejectedValue(new Error('failed'));

        let tree: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(
                <UpdateRequestPost post={makePost({playbookRunId: 'run-1', targetUsername: 'ada'})}/>,
            );
        });

        const json = JSON.stringify(tree!.toJSON());
        expect(json).toContain(originalMessage);
        expect(json).not.toContain('Post update');
    });

    it('keeps a post with no playbookRunId as the original message', async () => {
        mockFetchPlaybookRuns.mockResolvedValue({
            items: [reminderRun('run-old', 'Oldest run')],
        });

        let tree: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(
                <UpdateRequestPost post={makePost({targetUsername: 'ada'})}/>,
            );
        });

        const json = JSON.stringify(tree!.toJSON());
        expect(mockFetchPlaybookRun).not.toHaveBeenCalled();
        expect(json).toContain(originalMessage);
        expect(json).not.toContain('Post update');
        expect(json).not.toContain('Oldest run');
    });
});
