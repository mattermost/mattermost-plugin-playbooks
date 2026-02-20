// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from '@testing-library/react-hooks';
import {ClientError} from '@mattermost/client';

import * as client from 'src/client';
import {QuicklistGenerateResponse} from 'src/types/quicklist';

import {useQuicklistGenerate} from './use_quicklist';

jest.mock('src/client', () => ({
    generateQuicklist: jest.fn(),
}));

const mockGenerateQuicklist = client.generateQuicklist as jest.MockedFunction<typeof client.generateQuicklist>;

const mockResponse: QuicklistGenerateResponse = {
    title: 'Test Quicklist',
    checklists: [
        {
            id: 'checklist-1',
            title: 'Section 1',
            items: [
                {
                    id: 'item-1',
                    title: 'Task 1',
                    description: 'Description 1',
                    state: '',
                    state_modified: 0,
                    assignee_id: '',
                    assignee_modified: 0,
                    command: '',
                    command_last_run: 0,
                    due_date: 1705363200000,
                    task_actions: [],
                    condition_id: '',
                    condition_action: '',
                    condition_reason: '',
                },
            ],
            items_order: ['item-1'],
        },
    ],
    thread_info: {
        truncated: false,
        truncated_count: 0,
        message_count: 10,
        participant_count: 3,
    },
};

describe('useQuicklistGenerate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('starts with loading state', async () => {
        mockGenerateQuicklist.mockImplementation(() => new Promise(() => {
            // Never resolves - keeps loading state
        }));

        const {result} = renderHook(() => useQuicklistGenerate('post-123'));

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('returns data on successful fetch', async () => {
        mockGenerateQuicklist.mockResolvedValue(mockResponse);

        const {result, waitForNextUpdate} = renderHook(() => useQuicklistGenerate('post-123'));

        expect(result.current.isLoading).toBe(true);

        await waitForNextUpdate();

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toEqual(mockResponse);
        expect(result.current.error).toBeNull();
        expect(mockGenerateQuicklist).toHaveBeenCalledWith('post-123');
    });

    it('returns error on ClientError', async () => {
        const clientError = new ClientError('test-url', {
            message: 'API error',
            status_code: 500,
            url: '/api/v0/quicklist/generate',
        });
        mockGenerateQuicklist.mockRejectedValue(clientError);

        const {result, waitForNextUpdate} = renderHook(() => useQuicklistGenerate('post-123'));

        await waitForNextUpdate();

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBe(clientError);
    });

    it('wraps non-ClientError errors', async () => {
        const genericError = new Error('Network failure');
        mockGenerateQuicklist.mockRejectedValue(genericError);

        const {result, waitForNextUpdate} = renderHook(() => useQuicklistGenerate('post-123'));

        await waitForNextUpdate();

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeInstanceOf(ClientError);
        expect(result.current.error?.message).toBe('Network failure');
    });

    it('does not fetch when postId is empty', () => {
        const {result} = renderHook(() => useQuicklistGenerate(''));

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();
        expect(mockGenerateQuicklist).not.toHaveBeenCalled();
    });

    it('refetches when postId changes', async () => {
        const response1: QuicklistGenerateResponse = {...mockResponse, title: 'First'};
        const response2: QuicklistGenerateResponse = {...mockResponse, title: 'Second'};

        mockGenerateQuicklist
            .mockResolvedValueOnce(response1)
            .mockResolvedValueOnce(response2);

        let postId = 'post-1';
        const {result, waitForNextUpdate, rerender} = renderHook(() => useQuicklistGenerate(postId));

        await waitForNextUpdate();
        expect(result.current.data?.title).toBe('First');

        postId = 'post-2';
        rerender();

        await waitForNextUpdate();
        expect(result.current.data?.title).toBe('Second');
        expect(mockGenerateQuicklist).toHaveBeenCalledTimes(2);
    });

    it('cancels fetch on unmount', async () => {
        let resolvePromise: (value: QuicklistGenerateResponse) => void;
        mockGenerateQuicklist.mockImplementation(() => new Promise((resolve) => {
            resolvePromise = resolve;
        }));

        const {result, unmount} = renderHook(() => useQuicklistGenerate('post-123'));

        expect(result.current.isLoading).toBe(true);

        // Unmount before resolving
        unmount();

        // Resolve after unmount - should not cause state updates
        await act(async () => {
            resolvePromise!(mockResponse);
        });

        // No error should be thrown (would happen if trying to set state on unmounted)
    });

    it('exposes retry function', () => {
        // eslint-disable-next-line no-empty-function
        mockGenerateQuicklist.mockImplementation(() => new Promise(() => {}));

        const {result} = renderHook(() => useQuicklistGenerate('post-123'));

        expect(result.current.retry).toBeDefined();
        expect(typeof result.current.retry).toBe('function');
    });

    it('retry triggers new fetch after error', async () => {
        const clientError = new ClientError('test-url', {
            message: 'Service unavailable',
            status_code: 503,
            url: '/api/v0/quicklist/generate',
        });

        mockGenerateQuicklist.mockRejectedValueOnce(clientError);
        mockGenerateQuicklist.mockResolvedValueOnce(mockResponse);

        const {result, waitForNextUpdate} = renderHook(() => useQuicklistGenerate('post-123'));

        // Wait for first (failed) fetch
        await waitForNextUpdate();
        expect(result.current.error).toBe(clientError);
        expect(result.current.data).toBeNull();

        // Call retry
        act(() => {
            result.current.retry();
        });

        // Should be loading again
        expect(result.current.isLoading).toBe(true);

        // Wait for second (successful) fetch
        await waitForNextUpdate();
        expect(result.current.error).toBeNull();
        expect(result.current.data).toEqual(mockResponse);
        expect(mockGenerateQuicklist).toHaveBeenCalledTimes(2);
    });

    it('retry clears previous error', async () => {
        const clientError = new ClientError('test-url', {
            message: 'Service unavailable',
            status_code: 503,
            url: '/api/v0/quicklist/generate',
        });

        mockGenerateQuicklist.mockRejectedValueOnce(clientError);

        // eslint-disable-next-line no-empty-function
        mockGenerateQuicklist.mockImplementation(() => new Promise(() => {}));

        const {result, waitForNextUpdate} = renderHook(() => useQuicklistGenerate('post-123'));

        await waitForNextUpdate();
        expect(result.current.error).toBe(clientError);

        // Call retry
        act(() => {
            result.current.retry();
        });

        // Error should be cleared, loading should be true
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(true);
    });
});
