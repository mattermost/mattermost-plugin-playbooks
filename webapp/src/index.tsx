// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Action, Store} from 'redux';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';

import {pluginId} from './manifest';

import IncidentIcon from './components/incident_icon';
import RightHandSidebar from './components/rhs';
import StartIncidentPostMenu from './components/post_menu';
import BackstageModal from './components/backstage/backstage_modal';

import {Hooks} from './hooks';
import {setToggleRHSAction} from './actions';
import reducer from './reducer';
import {
    handleWebsocketIncidentUpdate,
    handleWebsocketIncidentCreated,
    handleWebsocketPlaybookCreateModify,
    handleWebsocketPlaybookDelete,
} from './websocket_events';
import {
    WEBSOCKET_INCIDENT_UPDATED,
    WEBSOCKET_INCIDENT_CREATED,
    WEBSOCKET_PLAYBOOK_DELETED,
    WEBSOCKET_PLAYBOOK_CREATED,
    WEBSOCKET_PLAYBOOK_UPDATED,
} from './types/websocket_events';

export default class Plugin {
    public initialize(registry: PluginRegistry, store: Store<object, Action<any>>): void {
        registry.registerReducer(reducer);

        const {toggleRHSPlugin} = registry.registerRightHandSidebarComponent(RightHandSidebar, null);
        const boundToggleRHSAction = (): void => store.dispatch(toggleRHSPlugin);

        // Store the toggleRHS action to use later
        store.dispatch(setToggleRHSAction(boundToggleRHSAction));

        registry.registerChannelHeaderButtonAction(IncidentIcon, boundToggleRHSAction, 'Incidents', 'Incidents');
        registry.registerPostDropdownMenuComponent(StartIncidentPostMenu);

        registry.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_UPDATED,
            handleWebsocketIncidentUpdate(store.dispatch, store.getState));

        registry.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_CREATED,
            handleWebsocketIncidentCreated(store.dispatch, store.getState));

        registry.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_CREATED,
            handleWebsocketPlaybookCreateModify(store.dispatch));

        registry.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_UPDATED,
            handleWebsocketPlaybookCreateModify(store.dispatch));

        registry.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_DELETED,
            handleWebsocketPlaybookDelete(store.dispatch));

        const hooks = new Hooks(store);
        registry.registerSlashCommandWillBePostedHook(hooks.slashCommandWillBePostedHook);

        registry.registerRootComponent(BackstageModal);
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
