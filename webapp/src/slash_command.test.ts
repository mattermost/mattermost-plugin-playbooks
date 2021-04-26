import {GlobalState} from 'mattermost-redux/types/store';
import configureStore, {MockStoreEnhanced} from 'redux-mock-store';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {makeSlashCommandHook} from './slash_command';

const mockStore = configureStore<GlobalState, DispatchFunc>();

test('makeSlashCommandHook leaves rejected slash commands unmodified', async () => {
    const initialState = {} as GlobalState;
    const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(initialState);

    const slashCommandHook = makeSlashCommandHook(store);
    const result = await slashCommandHook(undefined, undefined); //eslint-disable-line no-undefined

    expect(result.message).toBeUndefined();
    expect(result.args).toBeUndefined();
});
