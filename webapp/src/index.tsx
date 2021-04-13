// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Store} from 'redux';
import {debounce} from 'debounce';

import {GlobalState} from 'mattermost-redux/types/store';

//@ts-ignore Webapp imports don't work properly
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import WebsocketEvents from 'mattermost-redux/constants/websocket';

import {makeRHSOpener} from 'src/rhs_opener';
import {makeSlashCommandHook} from 'src/slash_command';

import {pluginId} from './manifest';
import ChannelHeaderButton from './components/assets/icons/channel_header_button';
import RightHandSidebar from './components/rhs/rhs_main';
import RHSTitle from './components/rhs/rhs_title';
import {AttachToIncidentPostMenu, StartIncidentPostMenu} from './components/post_menu';
import Backstage from './components/backstage/backstage';
import ErrorPage from './components/error_page';
import {
    setToggleRHSAction,
} from './actions';
import reducer from './reducer';
import {
    handleReconnect,
    handleWebsocketIncidentUpdated,
    handleWebsocketIncidentCreated,
    handleWebsocketUserAdded,
    handleWebsocketUserRemoved,
    handleWebsocketPostEditedOrDeleted,
    handleWebsocketChannelUpdated,
} from './websocket_events';
import {
    WEBSOCKET_INCIDENT_UPDATED,
    WEBSOCKET_INCIDENT_CREATED,
} from './types/websocket_events';
import RegistryWrapper from './registry_wrapper';
import {isE20LicensedOrDevelopment} from './license';
import SystemConsoleEnabledTeams from './system_console_enabled_teams';
import {makeUpdateMainMenu} from './make_update_main_menu';

export default class Plugin {
    public initialize(registry: PluginRegistry, store: Store<GlobalState>): void {
        registry.registerReducer(reducer);

        const updateMainMenuAction = makeUpdateMainMenu(registry, store);
        updateMainMenuAction();

        // Would rather use a saga and listen for ActionTypes.UPDATE_MOBILE_VIEW.
        window.addEventListener('resize', debounce(updateMainMenuAction, 300));
        store.subscribe(updateMainMenuAction);

        registry.registerAdminConsoleCustomSetting('EnabledTeams', SystemConsoleEnabledTeams, {showTitle: true});

        const doRegistrations = () => {
            const r = new RegistryWrapper(registry, store);

            const {toggleRHSPlugin} = r.registerRightHandSidebarComponent(RightHandSidebar, <RHSTitle/>);
            const boundToggleRHSAction = (): void => store.dispatch(toggleRHSPlugin);

            // Store the toggleRHS action to use later
            store.dispatch(setToggleRHSAction(boundToggleRHSAction));

            r.registerChannelHeaderButtonAction(ChannelHeaderButton, boundToggleRHSAction, 'Incidents', 'Incidents');
            r.registerPostDropdownMenuComponent(StartIncidentPostMenu);
            r.registerPostDropdownMenuComponent(AttachToIncidentPostMenu);

            r.registerReconnectHandler(handleReconnect(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_UPDATED, handleWebsocketIncidentUpdated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_CREATED, handleWebsocketIncidentCreated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.USER_ADDED, handleWebsocketUserAdded(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.USER_REMOVED, handleWebsocketUserRemoved(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.POST_DELETED, handleWebsocketPostEditedOrDeleted(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.POST_EDITED, handleWebsocketPostEditedOrDeleted(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.CHANNEL_UPDATED, handleWebsocketChannelUpdated(store.getState, store.dispatch));

            // Listen for channel changes and open the RHS when appropriate.
            store.subscribe(makeRHSOpener(store));

            r.registerSlashCommandWillBePostedHook(makeSlashCommandHook(store));

            r.registerNeedsTeamRoute('/error', ErrorPage);
            r.registerNeedsTeamRoute('/', Backstage);

            return r.unregister;
        };

        // Listen for license changes and update the UI appropriately. This is the only websocket
        // listener that stays active all the time, regardless of license.
        let registered = false;
        let unregister: () => void;
        const checkRegistrations = () => {
            updateMainMenuAction();

            if (!registered && isE20LicensedOrDevelopment(store.getState())) {
                unregister = doRegistrations();
                registered = true;
            } else if (unregister && !isE20LicensedOrDevelopment(store.getState())) {
                unregister();
                registered = false;
            }
        };
        registry.registerWebSocketEventHandler(WebsocketEvents.LICENSE_CHANGED, checkRegistrations);
        checkRegistrations();
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
