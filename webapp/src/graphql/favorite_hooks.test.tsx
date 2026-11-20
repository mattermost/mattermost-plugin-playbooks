// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from '@testing-library/react';

import {PlaybookDocument} from 'src/graphql/generated/graphql';

import {useSetRunFavorite, useUpdatePlaybookFavorite} from './hooks';

const mockSetPlaybookFavorite = jest.fn();
const mockSetRunFavorite = jest.fn();
jest.mock('src/client', () => ({
    setPlaybookFavorite: (...args: unknown[]) => mockSetPlaybookFavorite(...args),
    setRunFavorite: (...args: unknown[]) => mockSetRunFavorite(...args),
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

describe('favorite hooks', () => {
    beforeEach(() => {
        mockRefetchQueries.mockResolvedValue([]);
    });

    describe('useUpdatePlaybookFavorite', () => {
        it('refreshes the sidebar and playbook query only after the REST call succeeds', async () => {
            mockSetPlaybookFavorite.mockResolvedValue(undefined);
            const {result} = renderHook(() => useUpdatePlaybookFavorite('playbook-1'));

            await act(async () => {
                await result.current(true);
            });

            expect(mockSetPlaybookFavorite).toHaveBeenCalledWith('playbook-1', true);
            expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
            expect(mockRefetchQueries).toHaveBeenCalledWith({include: [PlaybookDocument]});
            expect(mockSetPlaybookFavorite.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshLHS.mock.invocationCallOrder[0]);
            expect(mockRefreshLHS.mock.invocationCallOrder[0]).toBeLessThan(mockRefetchQueries.mock.invocationCallOrder[0]);
        });

        it('logs a failed favorite and does not reload the sidebar or playbook query', async () => {
            const failure = new Error('favorite failed');
            mockSetPlaybookFavorite.mockRejectedValue(failure);
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const {result} = renderHook(() => useUpdatePlaybookFavorite('playbook-1'));

            await act(async () => {
                await result.current(false);
            });

            expect(mockSetPlaybookFavorite).toHaveBeenCalledWith('playbook-1', false);
            expect(errorSpy).toHaveBeenCalledWith('Failed to update playbook favorite', failure);
            expect(mockRefreshLHS).not.toHaveBeenCalled();
            expect(mockRefetchQueries).not.toHaveBeenCalled();
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
            expect(mockRefetchQueries).not.toHaveBeenCalled();
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
            expect(mockRefetchQueries).not.toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });
});
