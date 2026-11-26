// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from '@testing-library/react';

import {playbookRunUpdated} from 'src/actions';
import {RhsRunsDocument} from 'src/graphql/generated/graphql';
import {PlaybookRun} from 'src/types/playbook_run';

import {useUpdateRun} from './hooks';

const mockUpdatePlaybookRun = jest.fn();
jest.mock('src/client', () => ({
    updatePlaybookRun: (...args: unknown[]) => mockUpdatePlaybookRun(...args),
}));

const mockRefreshLHS = jest.fn();
jest.mock('src/components/backstage/lhs_navigation', () => ({
    useLHSRefresh: () => mockRefreshLHS,
}));

const mockRefetchQueries = jest.fn();
jest.mock('@apollo/client', () => {
    const actual = jest.requireActual('@apollo/client');
    return {
        ...actual,
        useApolloClient: () => ({
            refetchQueries: (...args: unknown[]) => mockRefetchQueries(...args),
        }),
    };
});

const mockDispatch = jest.fn();
jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => mockDispatch,
}));

describe('useUpdateRun', () => {
    const updated = {id: 'run-1', name: 'Incident'} as PlaybookRun;

    beforeEach(() => {
        mockRefetchQueries.mockResolvedValue([]);
    });

    it('does not request, dispatch, refresh, or refetch without an id', async () => {
        const {result} = renderHook(() => useUpdateRun());

        await act(async () => {
            await result.current({name: 'Incident'});
        });

        expect(mockUpdatePlaybookRun).not.toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockRefreshLHS).not.toHaveBeenCalled();
        expect(mockRefetchQueries).not.toHaveBeenCalled();
    });

    it('dispatches the updated run, refreshes the sidebar, and refetches RHS runs after success', async () => {
        mockUpdatePlaybookRun.mockResolvedValue(updated);
        const {result} = renderHook(() => useUpdateRun('run-1'));
        const updates = {name: 'Incident', summary: null};

        await act(async () => {
            await result.current(updates);
        });

        expect(mockUpdatePlaybookRun).toHaveBeenCalledWith('run-1', updates);
        expect(mockDispatch).toHaveBeenCalledWith(playbookRunUpdated(updated));
        expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
        expect(mockRefetchQueries).toHaveBeenCalledWith({include: [RhsRunsDocument]});
        expect(mockUpdatePlaybookRun.mock.invocationCallOrder[0]).toBeLessThan(mockDispatch.mock.invocationCallOrder[0]);
        expect(mockDispatch.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshLHS.mock.invocationCallOrder[0]);
        expect(mockRefreshLHS.mock.invocationCallOrder[0]).toBeLessThan(mockRefetchQueries.mock.invocationCallOrder[0]);
    });

    it('does not dispatch, refresh, or refetch when the update fails', async () => {
        const failure = new Error('update failed');
        mockUpdatePlaybookRun.mockRejectedValue(failure);
        const {result} = renderHook(() => useUpdateRun('run-1'));

        await act(async () => {
            await expect(result.current({name: 'Incident'})).rejects.toBe(failure);
        });

        expect(mockUpdatePlaybookRun).toHaveBeenCalledWith('run-1', {name: 'Incident'});
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockRefreshLHS).not.toHaveBeenCalled();
        expect(mockRefetchQueries).not.toHaveBeenCalled();
    });
});
