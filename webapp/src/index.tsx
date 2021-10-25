// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Store, Unsubscribe} from 'redux';
import {Redirect, useLocation, useRouteMatch} from 'react-router-dom';
import {debounce} from 'debounce';

//@ts-ignore Webapp imports don't work properly
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import {GlobalState} from 'mattermost-redux/types/store';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {Client4} from 'mattermost-redux/client';
import WebsocketEvents from 'mattermost-redux/constants/websocket';

import {makeRHSOpener} from 'src/rhs_opener';
import {makeSlashCommandHook} from 'src/slash_command';
import {
    RetrospectiveFirstReminder,
    RetrospectiveReminder,
} from 'src/components/retrospective_reminder_posts';
import {pluginId} from 'src/manifest';
import {
    ChannelHeaderButton,
    ChannelHeaderText,
    ChannelHeaderTooltip,
} from 'src/components/channel_header';
import RightHandSidebar from 'src/components/rhs/rhs_main';
import RHSTitle from 'src/components/rhs/rhs_title';
import {AttachToPlaybookRunPostMenu, StartPlaybookRunPostMenu} from 'src/components/post_menu';
import Backstage from 'src/components/backstage/backstage';
import PostMenuModal from 'src/components/post_menu_modal';
import {
    setToggleRHSAction, actionSetGlobalSettings,
} from 'src/actions';
import reducer from 'src/reducer';
import {
    handleReconnect,
    handleWebsocketPlaybookRunUpdated,
    handleWebsocketPlaybookRunCreated,
    handleWebsocketPlaybookCreated,
    handleWebsocketPlaybookDeleted,
    handleWebsocketPlaybookRestored,
    handleWebsocketUserAdded,
    handleWebsocketUserRemoved,
    handleWebsocketPostEditedOrDeleted,
    handleWebsocketChannelUpdated, handleWebsocketChannelViewed,
} from 'src/websocket_events';
import {
    WEBSOCKET_PLAYBOOK_RUN_UPDATED,
    WEBSOCKET_PLAYBOOK_RUN_CREATED,
    WEBSOCKET_PLAYBOOK_CREATED,
    WEBSOCKET_PLAYBOOK_DELETED,
    WEBSOCKET_PLAYBOOK_RESTORED,
} from 'src/types/websocket_events';
import RegistryWrapper from 'src/registry_wrapper';
import {makeUpdateMainMenu} from 'src/make_update_main_menu';
import {fetchGlobalSettings, notifyConnect, setSiteUrl} from 'src/client';
import {CloudUpgradePost} from 'src/components/cloud_upgrade_post';
import {UpdatePost} from 'src/components/update_post';
import {UpdateRequestPost} from 'src/components/update_request_post';

const GlobalHeaderCenter = () => {
    return null;
};

const OldRoutesRedirect = () => {
    const match = useRouteMatch();
    const location = useLocation();
    const redirPath = location.pathname.replace(match.url, '');

    return (
        <Redirect
            to={'/playbooks' + redirPath}
        />
    );
};

export default class Plugin {
    removeMainMenuSub?: Unsubscribe;
    removeRHSListener?: Unsubscribe;
    activityFunc?: () => void;

    public initialize(registry: PluginRegistry, store: Store<GlobalState>): void {
        registry.registerReducer(reducer);

        // Consume the SiteURL so that the client is subpath aware. We also do this for Client4
        // in our version of the mattermost-redux, since webapp only does it in its copy.
        const siteUrl = getConfig(store.getState())?.SiteURL || '';
        setSiteUrl(siteUrl);
        Client4.setUrl(siteUrl);

        registry.registerTranslations((locale: string) => {
            try {
                // eslint-disable-next-line global-require
                return require(`../i18n/${locale}.json`); // TODO make async, this increases bundle size exponentially
            } catch {
                return {};
            }
        });

        const updateMainMenuAction = makeUpdateMainMenu(registry);
        updateMainMenuAction();

        // Would rather use a saga and listen for ActionTypes.UPDATE_MOBILE_VIEW.
        window.addEventListener('resize', debounce(updateMainMenuAction, 300));
        this.removeMainMenuSub = store.subscribe(updateMainMenuAction);

        // Grab global settings
        const getGlobalSettings = async () => {
            store.dispatch(actionSetGlobalSettings(await fetchGlobalSettings()));
        };
        getGlobalSettings();

        if (registry.registerProduct) {
            registry.registerProduct(
                '/playbooks',
                'product-playbooks',
                'Playbooks',
                '/playbooks',
                Backstage,
                GlobalHeaderCenter,
            );
        }

        // Listen for new activity to trigger a call to the server
        // Hat tip to the Github plugin
        let lastActivityTime = Number.MAX_SAFE_INTEGER;
        const activityTimeout = 60 * 60 * 1000; // 1 hour

        this.activityFunc = () => {
            const now = new Date().getTime();
            if (now - lastActivityTime > activityTimeout) {
                notifyConnect();
            }
            lastActivityTime = now;
        };
        document.addEventListener('click', this.activityFunc);

        // Do our first connect
        notifyConnect();

        const doRegistrations = () => {
            const r = new RegistryWrapper(registry, store);

            const {toggleRHSPlugin} = r.registerRightHandSidebarComponent(RightHandSidebar,
                <RHSTitle/>);
            const boundToggleRHSAction = (): void => store.dispatch(toggleRHSPlugin);

            // Store the toggleRHS action to use later
            store.dispatch(setToggleRHSAction(boundToggleRHSAction));

            r.registerChannelHeaderButtonAction(ChannelHeaderButton, boundToggleRHSAction, ChannelHeaderText, ChannelHeaderTooltip);
            r.registerPostDropdownMenuComponent(StartPlaybookRunPostMenu);
            r.registerPostDropdownMenuComponent(AttachToPlaybookRunPostMenu);
            r.registerRootComponent(PostMenuModal);

            r.registerReconnectHandler(handleReconnect(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RUN_UPDATED, handleWebsocketPlaybookRunUpdated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RUN_CREATED, handleWebsocketPlaybookRunCreated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_CREATED, handleWebsocketPlaybookCreated(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_DELETED, handleWebsocketPlaybookDeleted(store.getState, store.dispatch));
            r.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RESTORED, handleWebsocketPlaybookRestored(store.getState, store.dispatch));
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

            // Redirect old routes
            r.registerNeedsTeamRoute('/error', OldRoutesRedirect);
            r.registerNeedsTeamRoute('/', OldRoutesRedirect);

            r.registerPostTypeComponent('custom_retro_rem_first', RetrospectiveFirstReminder);
            r.registerPostTypeComponent('custom_retro_rem', RetrospectiveReminder);
            r.registerPostTypeComponent('custom_cloud_upgrade', CloudUpgradePost);
            r.registerPostTypeComponent('custom_run_update', UpdatePost);
            r.registerPostTypeComponent('custom_update_status', UpdateRequestPost);

            return r.unregister;
        };

        // Listen for license changes and update the UI appropriately. This is the only websocket
        // listener that stays active all the time, regardless of license.
        let registered = false;
        let unregister: () => void;
        const checkRegistrations = () => {
            updateMainMenuAction();

            if (!registered) {
                unregister = doRegistrations();
                registered = true;
            } else if (unregister) {
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
        if (this.activityFunc) {
            document.removeEventListener('click', this.activityFunc);
            delete this.activityFunc;
        }
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
