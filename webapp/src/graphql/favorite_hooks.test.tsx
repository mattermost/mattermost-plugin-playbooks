// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook, waitFor} from '@testing-library/react';

import {usePlaybook, useSetRunFavorite, useUpdatePlaybookFavorite} from './hooks';

const mockSetPlaybookFavorite = jest.fn();
const mockSetRunFavorite = jest.fn();
const mockClientFetchPlaybook = jest.fn();
const mockIsFavoriteItem = jest.fn();
jest.mock('src/client', () => ({
    setPlaybookFavorite: (...args: unknown[]) => mockSetPlaybookFavorite(...args),
    setRunFavorite: (...args: unknown[]) => mockSetRunFavorite(...args),
    clientFetchPlaybook: (...args: unknown[]) => mockClientFetchPlaybook(...args),
    isFavoriteItem: (...args: unknown[]) => mockIsFavoriteItem(...args),
}));

const mockRefreshLHS = jest.fn();
jest.mock('src/components/backstage/lhs_navigation', () => ({
    useLHSRefresh: () => mockRefreshLHS,
}));

const playbook = {
    id: 'playbook-1',
    team_id: 'team-1',
    title: 'Playbook',
};

describe('favorite hooks', () => {
    beforeEach(() => {
        mockClientFetchPlaybook.mockResolvedValue(playbook);
        mockIsFavoriteItem.mockResolvedValue(false);
    });

    describe('useUpdatePlaybookFavorite', () => {
        const renderFavorite = () => {
            return renderHook(() => ({
                playbook: usePlaybook('playbook-1'),
                updateFavorite: useUpdatePlaybookFavorite('playbook-1'),
            }));
        };

        it('refreshes the sidebar and playbook only after the REST call succeeds', async () => {
            mockSetPlaybookFavorite.mockResolvedValue(undefined);
            const {result} = renderFavorite();

            await waitFor(() => {
                expect(result.current.playbook[1].loading).toBe(false);
            });
            const fetchesAfterLoad = mockClientFetchPlaybook.mock.calls.length;

            await act(async () => {
                await result.current.updateFavorite(true);
            });

            expect(mockSetPlaybookFavorite).toHaveBeenCalledWith('playbook-1', true);
            expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
            await waitFor(() => {
                expect(mockClientFetchPlaybook.mock.calls.length).toBeGreaterThan(fetchesAfterLoad);
            });
            expect(mockSetPlaybookFavorite.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshLHS.mock.invocationCallOrder[0]);
        });

        it('logs a failed favorite and does not reload the sidebar or playbook', async () => {
            const failure = new Error('favorite failed');
            mockSetPlaybookFavorite.mockRejectedValue(failure);
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const {result} = renderFavorite();

            await waitFor(() => {
                expect(result.current.playbook[1].loading).toBe(false);
            });
            const fetchesAfterLoad = mockClientFetchPlaybook.mock.calls.length;

            await act(async () => {
                await result.current.updateFavorite(false);
            });

            expect(mockSetPlaybookFavorite).toHaveBeenCalledWith('playbook-1', false);
            expect(errorSpy).toHaveBeenCalledWith('Failed to update playbook favorite', failure);
            expect(mockRefreshLHS).not.toHaveBeenCalled();
            expect(mockClientFetchPlaybook).toHaveBeenCalledTimes(fetchesAfterLoad);
            errorSpy.mockRestore();
        });
    });

    describe('useSetRunFavorite', () => {
        it('refreshes the sidebar only after the REST call succeeds', async () => {
            mockSetRunFavorite.mockResolvedValue(undefined);
            const {result} = renderHook(() => useSetRunFavorite('run-1'));

            await act(async () => {
                await result.current(true);
            });

            expect(mockSetRunFavorite).toHaveBeenCalledWith('run-1', true);
            expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
            expect(mockClientFetchPlaybook).not.toHaveBeenCalled();
            expect(mockSetRunFavorite.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshLHS.mock.invocationCallOrder[0]);
        });

        it('logs a failed favorite and does not reload the sidebar', async () => {
            const failure = new Error('run favorite failed');
            mockSetRunFavorite.mockRejectedValue(failure);
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const {result} = renderHook(() => useSetRunFavorite('run-1'));

            await act(async () => {
                await result.current(false);
            });

            expect(mockSetRunFavorite).toHaveBeenCalledWith('run-1', false);
            expect(errorSpy).toHaveBeenCalledWith('Failed to update run favorite', failure);
            expect(mockRefreshLHS).not.toHaveBeenCalled();
            expect(mockClientFetchPlaybook).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });
});
