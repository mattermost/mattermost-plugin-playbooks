// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Store, Unsubscribe} from 'redux';
import {debounce} from 'debounce';

import {GlobalState} from 'mattermost-redux/types/store';

//@ts-ignore Webapp imports don't work properly
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import WebsocketEvents from 'mattermost-redux/constants/websocket';

import {makeRHSOpener} from 'src/rhs_opener';
import {makeSlashCommandHook} from 'src/slash_command';

import {RetrospectiveFirstReminder, RetrospectiveReminder} from './components/retrospective_reminder_posts';

import {pluginId} from './manifest';
import ChannelHeaderButton from './components/assets/icons/channel_header_button';
import RightHandSidebar from './components/rhs/rhs_main';
import RHSTitle from './components/rhs/rhs_title';
import {AttachToPlaybookRunPostMenu, StartPlaybookRunPostMenu} from './components/post_menu';
import Backstage from './components/backstage/backstage';
import ErrorPage from './components/error_page';
import PostMenuModal from './components/post_menu_modal';
import {
    setToggleRHSAction, actionSetGlobalSettings,
} from './actions';
import reducer from './reducer';
import {
    handleReconnect,
    handleWebsocketPlaybookRunUpdated,
    handleWebsocketPlaybookRunCreated,
    handleWebsocketPlaybookCreated,
    handleWebsocketPlaybookDeleted,
    handleWebsocketUserAdded,
    handleWebsocketUserRemoved,
    handleWebsocketPostEditedOrDeleted,
    handleWebsocketChannelUpdated, handleWebsocketChannelViewed,
} from './websocket_events';
import {
    WEBSOCKET_PLAYBOOK_RUN_UPDATED,
    WEBSOCKET_PLAYBOOK_RUN_CREATED,
    WEBSOCKET_PLAYBOOK_CREATED,
    WEBSOCKET_PLAYBOOK_DELETED,
} from './types/websocket_events';
import RegistryWrapper from './registry_wrapper';
import {isE20LicensedOrDevelopment} from './license';
import SystemConsoleEnabledTeams from './system_console_enabled_teams';
import {makeUpdateMainMenu} from './make_update_main_menu';
import {fetchGlobalSettings} from './client';
import {CloudUpgradePost} from './components/cloud_upgrade_post';

export default class Plugin {
    removeMainMenuSub?: Unsubscribe;
    removeRHSListener?: Unsubscribe;

    public initialize(registry: PluginRegistry, store: Store<GlobalState>): void {
        registry.registerReducer(reducer);

        const updateMainMenuAction = makeUpdateMainMenu(registry, store);
        updateMainMenuAction();

        // Would rather use a saga and listen for ActionTypes.UPDATE_MOBILE_VIEW.
        window.addEventListener('resize', debounce(updateMainMenuAction, 300));
        this.removeMainMenuSub = store.subscribe(updateMainMenuAction);

        registry.registerAdminConsoleCustomSetting('EnabledTeams', SystemConsoleEnabledTeams, {showTitle: true});

        // Grab global settings
        const getGlobalSettings = async () => {
            store.dispatch(actionSetGlobalSettings(await fetchGlobalSettings()));
        };
        getGlobalSettings();

        const doRegistrations = () => {
            const r = new RegistryWrapper(registry, store);

            const {toggleRHSPlugin} = r.registerRightHandSidebarComponent(RightHandSidebar,
                <RHSTitle/>);
            const boundToggleRHSAction = (): void => store.dispatch(toggleRHSPlugin);

            // Store the toggleRHS action to use later
            store.dispatch(setToggleRHSAction(boundToggleRHSAction));

            r.registerChannelHeaderButtonAction(ChannelHeaderButton, boundToggleRHSAction, 'Playbook', 'Playbook');
            r.registerPostDropdownMenuComponent(StartPlaybookRunPostMenu);
            r.registerPostDropdownMenuComponent(AttachToPlaybookRunPostMenu);
            r.registerRootComponent(PostMenuModal);

            r.registerReconnectHandler(handleReconnect(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RUN_UPDATED, handleWebsocketPlaybookRunUpdated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RUN_CREATED, handleWebsocketPlaybookRunCreated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_CREATED, handleWebsocketPlaybookCreated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_DELETED, handleWebsocketPlaybookDeleted(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.USER_ADDED, handleWebsocketUserAdded(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.USER_REMOVED, handleWebsocketUserRemoved(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.POST_DELETED, handleWebsocketPostEditedOrDeleted(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.POST_EDITED, handleWebsocketPostEditedOrDeleted(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.CHANNEL_UPDATED, handleWebsocketChannelUpdated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WebsocketEvents.CHANNEL_VIEWED, handleWebsocketChannelViewed(store.getState, store.dispatch));

            // Listen for channel changes and open the RHS when appropriate.
            if (this.removeRHSListener) {
                this.removeRHSListener();
            }
            this.removeRHSListener = store.subscribe(makeRHSOpener(store));

            r.registerSlashCommandWillBePostedHook(makeSlashCommandHook(store));

            r.registerNeedsTeamRoute('/error', ErrorPage);
            r.registerNeedsTeamRoute('/', Backstage);

            r.registerPostTypeComponent('custom_retro_rem_first', RetrospectiveFirstReminder);
            r.registerPostTypeComponent('custom_retro_rem', RetrospectiveReminder);
            r.registerPostTypeComponent('custom_cloud_upgrade', CloudUpgradePost);

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

    public uninitialize() {
        if (this.removeMainMenuSub) {
            this.removeMainMenuSub();
            delete this.removeMainMenuSub;
        }
        if (this.removeRHSListener) {
            this.removeRHSListener();
            delete this.removeRHSListener;
        }
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
