// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import configureStore, {MockStoreEnhanced} from 'redux-mock-store';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import * as Selectors from 'src/selectors';
import * as Actions from 'src/actions';

import {makeSlashCommandHook} from './slash_command';

const mockStore = configureStore<GlobalState, DispatchFunc>();

jest.mock('@mdi/react', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('src/actions', () => ({
    ...jest.requireActual('src/actions'),
    openPlaybookRunModal: jest.fn().mockReturnValue({type: 'OPEN_MODAL'}),
    promptUpdateStatus: jest.fn(),
    setClientId: jest.fn(),
    toggleRHS: jest.fn(),
}));

// Minimal state shape for team/channel selectors
const stateWithTeamAndChannel = {
    entities: {
        teams: {currentTeamId: 'team-id-1', teams: {}, myMembers: {}},
        channels: {currentChannelId: 'channel-id-1', channels: {}, myMembers: {}},
        users: {currentUserId: 'user-id-1', profiles: {}},
        general: {config: {}},
        roles: {roles: {}},
        preferences: {myPreferences: {}},
    },
} as unknown as GlobalState;

test('makeSlashCommandHook leaves rejected slash commands unmodified', async () => {
    const inPlaybookRunChannel = jest.spyOn(Selectors, 'inPlaybookRunChannel');
    inPlaybookRunChannel.mockReturnValue(true);

    const initialState = {} as GlobalState;
    const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(initialState);

    const slashCommandHook = makeSlashCommandHook(store);
    const result = await slashCommandHook(undefined, undefined); //eslint-disable-line no-undefined

    expect(result).toEqual({});
});

test('/playbook run opens the run modal and swallows the command', async () => {
    const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(stateWithTeamAndChannel);

    const slashCommandHook = makeSlashCommandHook(store);
    const result = await slashCommandHook('/playbook run', {});

    expect(Actions.openPlaybookRunModal).toHaveBeenCalledWith({
        teamId: 'team-id-1',
        triggerChannelId: 'channel-id-1',
        onRunCreated: expect.any(Function),
    });

    // Command is swallowed — not sent to server
    expect(result).toEqual({});
});

test('/playbook run with trailing text still opens the modal', async () => {
    const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(stateWithTeamAndChannel);

    const slashCommandHook = makeSlashCommandHook(store);
    const result = await slashCommandHook('/playbook run some-extra-args', {});

    expect(Actions.openPlaybookRunModal).toHaveBeenCalled();
    expect(result).toEqual({});
});
