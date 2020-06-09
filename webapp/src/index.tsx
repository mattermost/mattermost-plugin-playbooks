// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Action, Store} from 'redux';
import {debounce} from 'debounce';

import {GlobalState} from 'mattermost-redux/types/store';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {registerCssVars, isMobile} from 'src/utils/utils';

import {pluginId} from './manifest';
import IncidentIcon from './components/assets/icons/incident_icon';
import RightHandSidebar from './components/rhs';
import RHSTitle from './components/rhs/rhs_title';
import StartIncidentPostMenu from './components/post_menu';
import Backstage from './components/backstage';

import {Hooks} from './hooks';
import {
    setToggleRHSAction,
    navigateToTeamPluginUrl,
} from './actions';
import reducer from './reducer';
import {BackstageArea} from './types/backstage';
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

        this.updateTheme(store.getState());

        let mainMenuActionId: string | null;
        const updateMainMenuAction = () => {
            if (mainMenuActionId && isMobile()) {
                registry.unregisterComponent(mainMenuActionId);
                mainMenuActionId = null;
            } else if (!mainMenuActionId && !isMobile()) {
                mainMenuActionId = registry.registerMainMenuAction(
                    'Incidents & Playbooks',
                    () => store.dispatch(navigateToTeamPluginUrl('/incidents')),
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

        // Listen to when the theme is loaded
        registry.registerWebSocketEventHandler('preferences_changed',
            () => this.updateTheme(store.getState()));

        const hooks = new Hooks(store);
        registry.registerSlashCommandWillBePostedHook(hooks.slashCommandWillBePostedHook);

        registry.registerNeedsTeamRoute('/incidents', () => <Backstage selectedArea={BackstageArea.Incidents}/>);
        registry.registerNeedsTeamRoute('/playbooks', () => <Backstage selectedArea={BackstageArea.Playbooks}/>);
    }

    public updateTheme(state: GlobalState) {
        const theme = getTheme(state);
        registerCssVars(theme);
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
