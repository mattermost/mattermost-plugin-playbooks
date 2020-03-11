// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Action, Store} from 'redux';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';

import manifest from './manifest';

import IncidentIcon from './components/incident_icon';
import RightHandSidebar from './components/rhs';

import {setShowRHSAction} from './actions';
import reducer from './reducer';

export default class Plugin {
    public initialize(registry: PluginRegistry, store: Store<object, Action<any>>): void {
        registry.registerReducer(reducer);

        const {showRHSPlugin} = registry.registerRightHandSidebarComponent(RightHandSidebar, 'Incidents');
        const bindedShowRHSAction = (): void => store.dispatch(showRHSPlugin);

        //Store the showRHS action to use later
        store.dispatch(setShowRHSAction(bindedShowRHSAction));

        registry.registerChannelHeaderButtonAction(IncidentIcon, bindedShowRHSAction, 'Incidents', 'Open');
    }
}

// @ts-ignore
window.registerPlugin(manifest.id, new Plugin());
