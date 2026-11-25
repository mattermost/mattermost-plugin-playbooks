// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from '@testing-library/react';

import {playbookRunUpdated} from 'src/actions';
import {PlaybookRun} from 'src/types/playbook_run';

import {useUpdateRun} from './playbooks';

const mockUpdatePlaybookRun = jest.fn();
jest.mock('src/client', () => ({
    updatePlaybookRun: (...args: unknown[]) => mockUpdatePlaybookRun(...args),
}));

const mockRefreshLHS = jest.fn();
jest.mock('src/components/backstage/lhs_navigation', () => ({
    useLHSRefresh: () => mockRefreshLHS,
}));

const mockNotifyRHSRefresh = jest.fn();
jest.mock('src/rhs_refresh', () => ({
    notifyRHSRefresh: () => mockNotifyRHSRefresh(),
}));

const mockDispatch = jest.fn();
jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => mockDispatch,
}));

describe('useUpdateRun', () => {
    const updated = {id: 'run-1', name: 'Incident'} as PlaybookRun;

    it('does not request, dispatch, or refresh without an id', async () => {
        const {result} = renderHook(() => useUpdateRun());

        await act(async () => {
            await result.current({name: 'Incident'});
        });

        expect(mockUpdatePlaybookRun).not.toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockRefreshLHS).not.toHaveBeenCalled();
        expect(mockNotifyRHSRefresh).not.toHaveBeenCalled();
    });

    it('dispatches the updated run and refreshes the sidebar and RHS after success', async () => {
        mockUpdatePlaybookRun.mockResolvedValue(updated);
        const {result} = renderHook(() => useUpdateRun('run-1'));
        const updates = {name: 'Incident', summary: null};

        await act(async () => {
            await result.current(updates);
        });

        expect(mockUpdatePlaybookRun).toHaveBeenCalledWith('run-1', updates);
        expect(mockDispatch).toHaveBeenCalledWith(playbookRunUpdated(updated));
        expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
        expect(mockNotifyRHSRefresh).toHaveBeenCalledTimes(1);
        expect(mockUpdatePlaybookRun.mock.invocationCallOrder[0]).toBeLessThan(mockDispatch.mock.invocationCallOrder[0]);
        expect(mockDispatch.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshLHS.mock.invocationCallOrder[0]);
        expect(mockRefreshLHS.mock.invocationCallOrder[0]).toBeLessThan(mockNotifyRHSRefresh.mock.invocationCallOrder[0]);
    });

    it('does not dispatch or refresh when the update fails', async () => {
        const failure = new Error('update failed');
        mockUpdatePlaybookRun.mockRejectedValue(failure);
        const {result} = renderHook(() => useUpdateRun('run-1'));

        await act(async () => {
            await expect(result.current({name: 'Incident'})).rejects.toBe(failure);
        });

        expect(mockUpdatePlaybookRun).toHaveBeenCalledWith('run-1', {name: 'Incident'});
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockRefreshLHS).not.toHaveBeenCalled();
        expect(mockNotifyRHSRefresh).not.toHaveBeenCalled();
    });
});
