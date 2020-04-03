// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Action, Store} from 'redux';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';

import {pluginId} from './manifest';

import IncidentIcon from './components/incident_icon';
import RightHandSidebar from './components/rhs';
import StartIncidentPostMenu from './components/post_menu';

import {setToggleRHSAction} from './actions';
import reducer from './reducer';
import {handleWebsocketIncidentUpdate, handleWebsocketIncidentCreated} from './websocket_events';
import {WEBSOCKET_INCIDENT_UPDATE, WEBSOCKET_INCIDENT_CREATED} from './types/websocket_events';

export default class Plugin {
    public initialize(registry: PluginRegistry, store: Store<object, Action<any>>): void {
        registry.registerReducer(reducer);

        const {toggleRHSPlugin} = registry.registerRightHandSidebarComponent(RightHandSidebar, '');
        const bindedToggleRHSAction = (): void => store.dispatch(toggleRHSPlugin);

        // Store the showRHS action to use later
        store.dispatch(setToggleRHSAction(bindedToggleRHSAction));

        registry.registerChannelHeaderButtonAction(IncidentIcon, bindedToggleRHSAction, 'Incidents', 'Incidents');
        registry.registerPostDropdownMenuComponent(StartIncidentPostMenu);

        registry.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_UPDATE,
            handleWebsocketIncidentUpdate(store.dispatch));

        registry.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_CREATED,
            handleWebsocketIncidentCreated(store.dispatch, store.getState));
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
