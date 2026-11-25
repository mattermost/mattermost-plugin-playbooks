// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from '@testing-library/react';

import {playbookRunUpdated} from 'src/actions';
import manifest from 'src/manifest';
import {PlaybookRun} from 'src/types/playbook_run';

import {useManageRunMembership} from './playbooks';

const mockAddRunParticipants = jest.fn();
const mockRemoveRunParticipants = jest.fn();
jest.mock('src/client', () => ({
    addRunParticipants: (...args: unknown[]) => mockAddRunParticipants(...args),
    removeRunParticipants: (...args: unknown[]) => mockRemoveRunParticipants(...args),
}));

const mockRefreshLHS = jest.fn();
jest.mock('src/components/backstage/lhs_navigation', () => ({
    useLHSRefresh: () => mockRefreshLHS,
}));

const mockDispatch = jest.fn();
const mockGetState = jest.fn();
jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => mockDispatch,
    useAppStore: () => ({getState: mockGetState}),
}));

const runID = 'run-1';
const userIDs = ['user-1', 'user-2'];
const currentUserId = 'current-user';
const pluginStateKey = `plugins-${manifest.id}`;

const stateWithRuns = (runsByTeam: Record<string, Record<string, {id: string}> | null>) => ({
    entities: {users: {currentUserId}},
    [pluginStateKey]: {myPlaybookRunsByTeam: runsByTeam},
});

describe('useManageRunMembership', () => {
    beforeEach(() => {
        mockGetState.mockImplementation(() => stateWithRuns({}));
    });

    it('makes no request when runID or userIDs is empty', async () => {
        const missingRun = renderHook(() => useManageRunMembership());
        const emptyRun = renderHook(() => useManageRunMembership(''));
        const withRun = renderHook(() => useManageRunMembership(runID));

        await act(async () => {
            await missingRun.result.current.addToRun(userIDs, true);
            await missingRun.result.current.removeFromRun(userIDs);
            await emptyRun.result.current.addToRun(userIDs);
            await emptyRun.result.current.removeFromRun(userIDs);
            await withRun.result.current.addToRun();
            await withRun.result.current.addToRun([]);
            await withRun.result.current.removeFromRun();
            await withRun.result.current.removeFromRun([]);
        });

        expect(mockAddRunParticipants).not.toHaveBeenCalled();
        expect(mockRemoveRunParticipants).not.toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockRefreshLHS).not.toHaveBeenCalled();
    });

    it('defaults an omitted forceAddToChannel to false', async () => {
        const updatedRun = {id: runID} as PlaybookRun;
        mockAddRunParticipants.mockResolvedValue(updatedRun);
        const {result} = renderHook(() => useManageRunMembership(runID));

        await act(async () => {
            await result.current.addToRun(userIDs);
        });

        expect(mockAddRunParticipants).toHaveBeenCalledWith(runID, userIDs, false);

        await act(async () => {
            await result.current.addToRun(userIDs, true);
        });

        expect(mockAddRunParticipants).toHaveBeenLastCalledWith(runID, userIDs, true);
    });

    it('dispatches the returned run and refreshes the LHS', async () => {
        const addedRun = {id: runID, name: 'added'} as PlaybookRun;
        mockAddRunParticipants.mockResolvedValue(addedRun);
        const {result} = renderHook(() => useManageRunMembership(runID));

        await act(async () => {
            await result.current.addToRun(userIDs, true);
        });

        expect(mockDispatch).toHaveBeenCalledWith(playbookRunUpdated(addedRun));
        expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
        expect(mockAddRunParticipants.mock.invocationCallOrder[0]).toBeLessThan(mockDispatch.mock.invocationCallOrder[0]);
        expect(mockDispatch.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshLHS.mock.invocationCallOrder[0]);

        const removedRun = {id: runID, name: 'removed'} as PlaybookRun;
        mockRemoveRunParticipants.mockResolvedValue(removedRun);
        mockDispatch.mockClear();
        mockRefreshLHS.mockClear();

        await act(async () => {
            await result.current.removeFromRun(userIDs);
        });

        expect(mockRemoveRunParticipants).toHaveBeenCalledWith(runID, userIDs);
        expect(mockDispatch).toHaveBeenCalledWith(playbookRunUpdated(removedRun));
        expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
        expect(mockRemoveRunParticipants.mock.invocationCallOrder[0]).toBeLessThan(mockDispatch.mock.invocationCallOrder[0]);
        expect(mockDispatch.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshLHS.mock.invocationCallOrder[0]);
    });

    it('propagates a rejected request without dispatching or refreshing', async () => {
        const addFailure = new Error('add failed');
        mockAddRunParticipants.mockRejectedValue(addFailure);
        const {result} = renderHook(() => useManageRunMembership(runID));

        await act(async () => {
            await expect(result.current.addToRun(userIDs)).rejects.toBe(addFailure);
        });

        expect(mockAddRunParticipants).toHaveBeenCalledWith(runID, userIDs, false);
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockRefreshLHS).not.toHaveBeenCalled();

        const removeFailure = new Error('remove failed');
        mockRemoveRunParticipants.mockRejectedValue(removeFailure);

        await act(async () => {
            await expect(result.current.removeFromRun(userIDs)).rejects.toBe(removeFailure);
        });

        expect(mockRemoveRunParticipants).toHaveBeenCalledWith(runID, userIDs);
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockRefreshLHS).not.toHaveBeenCalled();
    });

    it('dispatches a self-removal when the run channel is still in the map', async () => {
        const channelId = 'channel-1';
        const removedRun = {id: runID, channel_id: channelId, team_id: 'team-1'} as PlaybookRun;
        mockGetState.mockImplementation(() => stateWithRuns({
            'team-1': {
                [channelId]: {id: runID},
            },
        }));
        mockRemoveRunParticipants.mockResolvedValue(removedRun);
        const {result} = renderHook(() => useManageRunMembership(runID));

        await act(async () => {
            await result.current.removeFromRun([currentUserId]);
        });

        expect(mockRemoveRunParticipants).toHaveBeenCalledWith(runID, [currentUserId]);
        expect(mockDispatch).toHaveBeenCalledWith(playbookRunUpdated(removedRun));
        expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
        expect(mockRemoveRunParticipants.mock.invocationCallOrder[0]).toBeLessThan(mockGetState.mock.invocationCallOrder[0]);
        expect(mockGetState.mock.invocationCallOrder[0]).toBeLessThan(mockDispatch.mock.invocationCallOrder[0]);
    });

    it('does not restore a run cleared by channel removal before the request returns', async () => {
        const channelId = 'channel-1';
        const teamId = 'team-1';
        const removedRun = {id: runID, channel_id: channelId, team_id: teamId} as PlaybookRun;
        let runsByChannel: Record<string, {id: string}> = {
            [channelId]: {id: runID},
        };
        mockGetState.mockImplementation(() => stateWithRuns({
            [teamId]: runsByChannel,
        }));
        mockRemoveRunParticipants.mockImplementation(async () => {
            runsByChannel = {};
            return removedRun;
        });
        const {result} = renderHook(() => useManageRunMembership(runID));

        await act(async () => {
            await result.current.removeFromRun([currentUserId]);
        });

        expect(mockRemoveRunParticipants).toHaveBeenCalledWith(runID, [currentUserId]);
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
        expect(mockRemoveRunParticipants.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshLHS.mock.invocationCallOrder[0]);
    });
});
