// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Action, Store} from 'redux';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';

import manifest from './manifest';

import IncidentIcon from './components/incident_icon';
import RightHandSidebar from './components/rhs';
import StartIncidentPostMenu from './components/post_menu';

import {setToggleRHSAction} from './actions';
import reducer from './reducer';

export default class Plugin {
    public initialize(registry: PluginRegistry, store: Store<object, Action<any>>): void {
        registry.registerReducer(reducer);

        const {toggleRHSPlugin} = registry.registerRightHandSidebarComponent(RightHandSidebar, 'Incidents');
        const bindedToggleRHSAction = (): void => store.dispatch(toggleRHSPlugin);

        // Store the showRHS action to use later
        store.dispatch(setToggleRHSAction(bindedToggleRHSAction));

        registry.registerChannelHeaderButtonAction(IncidentIcon, bindedToggleRHSAction, 'Incidents', 'Incidents');
        registry.registerPostDropdownMenuComponent(StartIncidentPostMenu);
    }
}

// @ts-ignore
window.registerPlugin(manifest.id, new Plugin());
