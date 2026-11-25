// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Store} from 'src/types/store';
import {toggleRHS} from 'src/actions';
import {isChannelEmbedded, resetEmbeddedRegistry, suppressAutoOpen} from 'src/components/embedded_checklist/embedded_run_registry';
import {PlaybookRunStatus} from 'src/types/playbook_run';

import {makeRHSOpener} from './rhs_opener';

const mockInPlaybookRunChannel = jest.fn();
const mockCurrentPlaybookRun = jest.fn();
const mockRhsOpen = jest.fn();

jest.mock('src/selectors', () => ({
    currentPlaybookRun: () => mockCurrentPlaybookRun(),
    inPlaybookRunChannel: () => mockInPlaybookRunChannel(),
    isPlaybookRunRHSOpen: () => mockRhsOpen(),
}));

jest.mock('src/actions', () => ({
    receivedTeamPlaybookRunConnections: jest.fn((runs) => ({type: 'RECEIVED_CONNECTIONS', runs})),
    toggleRHS: jest.fn(() => ({type: 'TOGGLE_RHS'})),
}));

jest.mock('src/webapp_globals', () => ({
    browserHistory: {replace: jest.fn()},
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getCurrentChannel: (state: any) => state.channel,
}));
jest.mock('mattermost-redux/selectors/entities/teams', () => ({
    getCurrentTeam: (state: any) => state.team,
}));
jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUserId: () => 'user_1',
}));

const graphqlClient = {
    query: jest.fn().mockResolvedValue({data: {runs: {edges: []}}}),
} as any;

const makeStore = (channelId: string, mmRhsOpen = false) => ({
    getState: () => ({
        channel: {id: channelId},
        team: {id: 'team_1'},
        views: {rhs: {isSidebarOpen: mmRhsOpen}},
    }),
    dispatch: jest.fn(),
}) as unknown as Store & {dispatch: jest.Mock};

const goTo = (channelId: string, search = '') => window.history.pushState({}, '', `/team/channels/${channelId}${search}`);

describe('makeRHSOpener', () => {
    beforeEach(() => {
        resetEmbeddedRegistry();
        (toggleRHS as jest.Mock).mockClear();
        mockInPlaybookRunChannel.mockReturnValue(true);
        mockCurrentPlaybookRun.mockReturnValue({current_status: PlaybookRunStatus.InProgress});
        mockRhsOpen.mockReturnValue(false);
    });

    it('opens the RHS when entering a channel with an in-progress run', async () => {
        goTo('channel_1');
        const store = makeStore('channel_1');

        await makeRHSOpener(store, graphqlClient)();

        expect(store.dispatch).toHaveBeenCalledTimes(2);
        expect(toggleRHS).toHaveBeenCalledTimes(1);
    });

    it('does not open the RHS in a channel suppressed by the host', async () => {
        goTo('channel_1');
        const store = makeStore('channel_1');
        suppressAutoOpen('channel_1');

        await makeRHSOpener(store, graphqlClient)();

        expect(toggleRHS).not.toHaveBeenCalled();
    });

    it('still opens the RHS in other channels while one is suppressed', async () => {
        goTo('channel_2');
        const store = makeStore('channel_2');
        suppressAutoOpen('channel_1');

        await makeRHSOpener(store, graphqlClient)();

        expect(toggleRHS).toHaveBeenCalledTimes(1);
    });

    it('opens the RHS again once the suppression is released', async () => {
        goTo('channel_1');
        const store = makeStore('channel_1');
        const release = suppressAutoOpen('channel_1');
        release();

        await makeRHSOpener(store, graphqlClient)();

        expect(isChannelEmbedded('channel_1')).toBe(false);
        expect(toggleRHS).toHaveBeenCalledTimes(1);
    });

    it('keeps honouring an explicit forceRHSOpen in a suppressed channel', async () => {
        goTo('channel_1', '?forceRHSOpen=true');
        const store = makeStore('channel_1');
        suppressAutoOpen('channel_1');

        await makeRHSOpener(store, graphqlClient)();

        expect(toggleRHS).toHaveBeenCalledTimes(1);
    });
});
