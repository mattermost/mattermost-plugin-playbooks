// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Store} from 'redux';
import {debounce} from 'debounce';

import {GlobalState} from 'mattermost-redux/types/store';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {registerCssVars, isMobile, navigateToTeamPluginUrl} from 'src/utils/utils';

import {pluginId} from './manifest';
import IncidentIcon from './components/assets/icons/incident_icon';
import RightHandSidebar from './components/rhs/rhs_main';
import RHSTitle from './components/rhs/rhs_title';
import StartIncidentPostMenu from './components/post_menu';
import Backstage from './components/backstage/backstage';

import {
    setToggleRHSAction,
} from './actions';
import reducer from './reducer';
import {
    handleWebsocketIncidentUpdate,
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

        this.updateTheme(store.getState());

        let mainMenuActionId: string | null;
        const updateMainMenuAction = () => {
            if (mainMenuActionId && isMobile()) {
                registry.unregisterComponent(mainMenuActionId);
                mainMenuActionId = null;
            } else if (!mainMenuActionId && !isMobile()) {
                mainMenuActionId = registry.registerMainMenuAction(
                    'Incidents & Playbooks',
                    () => {
                        const team = getCurrentTeam(store.getState());
                        navigateToTeamPluginUrl(team.name, '/incidents');
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

        registry.registerChannelHeaderButtonAction(IncidentIcon, boundToggleRHSAction, 'Incidents', 'Incidents');
        registry.registerPostDropdownMenuComponent(StartIncidentPostMenu);

        registry.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_UPDATED, handleWebsocketIncidentUpdate());
        registry.registerWebSocketEventHandler(WEBSOCKET_INCIDENT_CREATED, handleWebsocketIncidentUpdate());

        // Listen to when the theme is loaded
        registry.registerWebSocketEventHandler('preferences_changed',
            () => this.updateTheme(store.getState() as GlobalState));

        // Listen for channel changes and open the RHS when approperate.
        store.subscribe(makeRHSOpener(store));

        registry.registerSlashCommandWillBePostedHook(makeSlashCommandHook(store));

        registry.registerNeedsTeamRoute('/', Backstage);
    }

    updateTheme(state: GlobalState): void {
        const theme = getTheme(state);
        registerCssVars(theme);
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
