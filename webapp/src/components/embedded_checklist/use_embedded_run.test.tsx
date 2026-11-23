// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook, waitFor} from '@testing-library/react';

import {playbookRunUpdated} from 'src/actions';
import {fetchPlaybookRun} from 'src/client';
import {PlaybookRun} from 'src/types/playbook_run';

import {refetchEmbeddedRuns, resetEmbeddedRegistry} from './embedded_run_registry';
import {useEmbeddedRun} from './use_embedded_run';

jest.mock('src/client', () => ({
    fetchPlaybookRun: jest.fn(),
}));

let mockRuns: Record<string, PlaybookRun> = {};
const mockDispatch = jest.fn();

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => mockDispatch,
    useAppSelector: (selector: (state: unknown) => unknown) => selector({'plugins-playbooks': {myPlaybookRuns: mockRuns}}),
}));

const mockFetch = fetchPlaybookRun as jest.Mock;

const run = (id: string) => ({id, name: id} as PlaybookRun);

const deferred = <T, >() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
};

describe('useEmbeddedRun', () => {
    beforeEach(() => {
        mockRuns = {};
        mockDispatch.mockReset();
        mockFetch.mockReset();
        resetEmbeddedRegistry();
    });

    it('is loading until the first fetch resolves, then dispatches the run', async () => {
        const request = deferred<PlaybookRun>();
        mockFetch.mockReturnValue(request.promise);

        const {result} = renderHook(() => useEmbeddedRun('run_1'));
        expect(result.current.status).toBe('loading');

        await act(async () => {
            request.resolve(run('run_1'));
        });

        expect(mockDispatch).toHaveBeenCalledWith(playbookRunUpdated(run('run_1')));
    });

    it('shows a cached run immediately and still revalidates', async () => {
        mockRuns = {run_1: run('run_1')};
        mockFetch.mockResolvedValue(run('run_1'));

        const {result} = renderHook(() => useEmbeddedRun('run_1'));

        expect(result.current.status).toBe('ready');
        expect(result.current.run?.id).toBe('run_1');
        await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('run_1'));
    });

    it.each([403, 404])('reports unavailable on a %s response', async (status_code) => {
        mockFetch.mockRejectedValue({status_code});

        const {result} = renderHook(() => useEmbeddedRun('run_1'));

        await waitFor(() => expect(result.current.status).toBe('unavailable'));
    });

    it('reports unavailable when access is revoked for a cached run', async () => {
        mockRuns = {run_1: run('run_1')};
        mockFetch.mockRejectedValue({status_code: 403});

        const {result} = renderHook(() => useEmbeddedRun('run_1'));

        await waitFor(() => expect(result.current.status).toBe('unavailable'));
    });

    it('reports an error on other failures and retries on demand', async () => {
        mockFetch.mockRejectedValueOnce({status_code: 500});

        const {result} = renderHook(() => useEmbeddedRun('run_1'));
        await waitFor(() => expect(result.current.status).toBe('error'));

        mockFetch.mockResolvedValueOnce(run('run_1'));
        act(() => result.current.retry());

        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
        expect(mockDispatch).toHaveBeenCalledWith(playbookRunUpdated(run('run_1')));
    });

    it('keeps showing a cached run when revalidation fails with a server error', async () => {
        mockRuns = {run_1: run('run_1')};
        mockFetch.mockRejectedValue({status_code: 500});

        const {result} = renderHook(() => useEmbeddedRun('run_1'));

        await waitFor(() => expect(mockFetch).toHaveBeenCalled());
        expect(result.current.status).toBe('ready');
    });

    it('ignores a stale response after the run id changes', async () => {
        const first = deferred<PlaybookRun>();
        const second = deferred<PlaybookRun>();
        mockFetch.mockImplementation((id: string) => (id === 'run_1' ? first.promise : second.promise));

        const {rerender} = renderHook(({id}) => useEmbeddedRun(id), {initialProps: {id: 'run_1'}});
        rerender({id: 'run_2'});

        await act(async () => {
            first.resolve(run('run_1'));
        });
        expect(mockDispatch).not.toHaveBeenCalled();

        await act(async () => {
            second.resolve(run('run_2'));
        });
        expect(mockDispatch).toHaveBeenCalledWith(playbookRunUpdated(run('run_2')));
    });

    it('does not carry a failure over to a different run', async () => {
        mockFetch.mockRejectedValueOnce({status_code: 404});
        const {result, rerender} = renderHook(({id}) => useEmbeddedRun(id), {initialProps: {id: 'run_1'}});
        await waitFor(() => expect(result.current.status).toBe('unavailable'));

        mockFetch.mockReturnValue(new Promise(() => undefined));
        rerender({id: 'run_2'});

        expect(result.current.status).toBe('loading');
    });

    it('does nothing for an empty run id', () => {
        const {result} = renderHook(() => useEmbeddedRun(''));

        expect(result.current.status).toBe('loading');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('registers the run for reconnect refetch while mounted', async () => {
        mockFetch.mockResolvedValue(run('run_1'));
        const {unmount} = renderHook(() => useEmbeddedRun('run_1'));
        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

        await refetchEmbeddedRuns(mockDispatch);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        unmount();
        await refetchEmbeddedRuns(mockDispatch);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
