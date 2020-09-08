// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Store} from 'redux';
import {debounce} from 'debounce';

import {GlobalState} from 'mattermost-redux/types/store';

//@ts-ignore Webapp imports don't work properly
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {isMobile} from 'src/mobile';
import {navigateToTeamPluginUrl} from 'src/browser_routing';

import {pluginId} from './manifest';
import ChannelHeaderButton from './components/assets/icons/channel_header_button';
import RightHandSidebar from './components/rhs/rhs_main';
import RHSTitle from './components/rhs/rhs_title';
import StartIncidentPostMenu from './components/post_menu';
import Backstage from './components/backstage/backstage';
import ErrorPage from './components/error_page';

import {
    setToggleRHSAction,
} from './actions';
import reducer from './reducer';
import {
    handleReconnect,
    handleWebsocketIncidentUpdate,
    handleWebsocketIncidentCreate,
} from './websocket_events';
import {
    WEBSOCKET_INCIDENT_UPDATED,
    WEBSOCKET_INCIDENT_CREATED,
} from './types/websocket_events';
import {makeRHSOpener} from './rhs_opener';
import {makeSlashCommandHook} from './slash_command';

export default class Plugin {
    public initialize(registry: PluginRegistry, store: Store<GlobalState>): void {
        registry.registerReducer(reducer);

        let mainMenuActionId: string | null;
        const updateMainMenuAction = () => {
            if (mainMenuActionId && isMobile()) {
                registry.unregisterComponent(mainMenuActionId);
                mainMenuActionId = null;
            } else if (!mainMenuActionId && !isMobile()) {
                mainMenuActionId = registry.registerMainMenuAction(
                    'Playbooks & Incidents',
                    () => {
                        const team = getCurrentTeam(store.getState());
                        navigateToTeamPluginUrl(team.name, '/playbooks');
                    },
                );
            }
        };

        updateMainMenuAction();

        // Would rather use a saga and listen for ActionTypes.UPDATE_MOBILE_VIEW.
        window.addEventListener('resize', debounce(updateMainMenuAction, 300));

        const {toggleRHSPlugin} = registry.registerRightHandSidebarComponent(RightHandSidebar, <RHSTitle/>);
        const boundToggleRHSAction = (): void => store.dispatch(toggleRHSPlugin);

        // Store the toggleRHS action to use later
        store.dispatch(setToggleRHSAction(boundToggleRHSAction));

        registry.registerChannelHeaderButtonAction(ChannelHeaderButton, boundToggleRHSAction, 'Incidents', 'Incidents');
        registry.registerPostDropdownMenuComponent(StartIncidentPostMenu);

        registry.registerReconnectHandler(handleReconnect(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_UPDATED, handleWebsocketIncidentUpdate());
        registry.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_CREATED, handleWebsocketIncidentCreate(store.getState, store.dispatch));

        // Listen for channel changes and open the RHS when appropriate.
        store.subscribe(makeRHSOpener(store));

        registry.registerSlashCommandWillBePostedHook(makeSlashCommandHook(store));

        registry.registerNeedsTeamRoute('/error', ErrorPage);
        registry.registerNeedsTeamRoute('/', Backstage);
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
