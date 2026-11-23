// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {playbookRunUpdated} from 'src/actions';
import {fetchPlaybookRun} from 'src/client';
import {PlaybookRun} from 'src/types/playbook_run';

import {
    isChannelEmbedded,
    refetchEmbeddedRuns,
    registerEmbeddedRun,
    resetEmbeddedRegistry,
    suppressAutoOpen,
} from './embedded_run_registry';

jest.mock('src/client', () => ({
    fetchPlaybookRun: jest.fn(),
}));

const mockFetch = fetchPlaybookRun as jest.Mock;

describe('embedded run registry', () => {
    beforeEach(() => {
        resetEmbeddedRegistry();
        mockFetch.mockReset();
    });

    describe('channel suppression', () => {
        it('is ref-counted', () => {
            const releaseA = suppressAutoOpen('channel_1');
            const releaseB = suppressAutoOpen('channel_1');
            expect(isChannelEmbedded('channel_1')).toBe(true);

            releaseA();
            expect(isChannelEmbedded('channel_1')).toBe(true);

            releaseB();
            expect(isChannelEmbedded('channel_1')).toBe(false);
        });

        it('ignores a release that is called twice', () => {
            const releaseA = suppressAutoOpen('channel_1');
            suppressAutoOpen('channel_1');

            releaseA();
            releaseA();

            expect(isChannelEmbedded('channel_1')).toBe(true);
        });

        it('tracks channels independently', () => {
            suppressAutoOpen('channel_1');

            expect(isChannelEmbedded('channel_1')).toBe(true);
            expect(isChannelEmbedded('channel_2')).toBe(false);
        });
    });

    describe('refetchEmbeddedRuns', () => {
        it('refetches each mounted run once and dispatches the result', async () => {
            const run = {id: 'run_1'} as PlaybookRun;
            const other = {id: 'run_2'} as PlaybookRun;
            mockFetch.mockImplementation(async (id: string) => (id === 'run_1' ? run : other));
            const dispatch = jest.fn();

            registerEmbeddedRun('run_1');
            registerEmbeddedRun('run_1');
            registerEmbeddedRun('run_2');
            await refetchEmbeddedRuns(dispatch);

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(dispatch).toHaveBeenCalledWith(playbookRunUpdated(run));
            expect(dispatch).toHaveBeenCalledWith(playbookRunUpdated(other));
        });

        it('stops refetching a run once it is unmounted', async () => {
            const release = registerEmbeddedRun('run_1');
            release();

            await refetchEmbeddedRuns(jest.fn());

            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('keeps going when one refetch fails', async () => {
            const run = {id: 'run_2'} as PlaybookRun;
            mockFetch.mockImplementation(async (id: string) => {
                if (id === 'run_1') {
                    throw new Error('offline');
                }
                return run;
            });
            const dispatch = jest.fn();

            registerEmbeddedRun('run_1');
            registerEmbeddedRun('run_2');
            await refetchEmbeddedRuns(dispatch);

            expect(dispatch).toHaveBeenCalledTimes(1);
            expect(dispatch).toHaveBeenCalledWith(playbookRunUpdated(run));
        });
    });

    it('reset clears runs and suppressed channels', async () => {
        registerEmbeddedRun('run_1');
        suppressAutoOpen('channel_1');

        resetEmbeddedRegistry();
        await refetchEmbeddedRuns(jest.fn());

        expect(mockFetch).not.toHaveBeenCalled();
        expect(isChannelEmbedded('channel_1')).toBe(false);
    });
});
