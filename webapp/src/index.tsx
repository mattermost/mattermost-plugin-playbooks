// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, unmountComponentAtNode} from 'react-dom';
import {Store, Unsubscribe} from 'redux';
import {Redirect, useLocation, useRouteMatch} from 'react-router-dom';

//@ts-ignore Webapp imports don't work properly
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import {GlobalState} from '@mattermost/types/store';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {Client4} from 'mattermost-redux/client';
import WebsocketEvents from 'mattermost-redux/constants/websocket';
import {General} from 'mattermost-redux/constants';

import {loadRolesIfNeeded} from 'mattermost-webapp/packages/mattermost-redux/src/actions/roles';
import {FormattedMessage} from 'react-intl';

import {ApolloClient, NormalizedCacheObject} from '@apollo/client';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {GlobalSelectStyle} from 'src/components/backstage/styles';
import GlobalHeaderRight from 'src/components/global_header_right';

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
import {AttachToPlaybookRunPostMenu, StartPlaybookRunPostMenu} from 'src/components/post_menu';
import Backstage from 'src/components/backstage/backstage';
import PostMenuModal from 'src/components/post_menu_modal';
import ChannelActionsModal from 'src/components/channel_actions_modal';
import {
    setToggleRHSAction, actionSetGlobalSettings, showChannelActionsModal,
} from 'src/actions';
import reducer from 'src/reducer';
import {
    handleReconnect,
    handleWebsocketPlaybookRunUpdated,
    handleWebsocketPlaybookRunCreated,
    handleWebsocketPlaybookCreated,
    handleWebsocketPlaybookArchived,
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
    WEBSOCKET_PLAYBOOK_ARCHIVED,
    WEBSOCKET_PLAYBOOK_RESTORED,
} from 'src/types/websocket_events';
import {fetchGlobalSettings, fetchSiteStats, getMyTopPlaybooks, getTeamTopPlaybooks, notifyConnect, setSiteUrl} from 'src/client';
import {CloudUpgradePost} from 'src/components/cloud_upgrade_post';
import {UpdatePost} from 'src/components/update_post';
import {UpdateRequestPost} from 'src/components/update_request_post';

import {PlaybookRole} from './types/permissions';
import {RetrospectivePost} from './components/retrospective_post';

import {setPlaybooksGraphQLClient} from './graphql_client';
import {RHSTitlePlaceholder} from './rhs_title_remote_render';
import {ApolloWrapper, makeGraphqlClient} from './graphql/apollo';

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

type WindowObject = {
    location: {
        origin: string;
        protocol: string;
        hostname: string;
        port: string;
    };
    basename?: string;
}

// From mattermost-webapp/utils
function getSiteURLFromWindowObject(obj: WindowObject): string {
    let siteURL = '';
    if (obj.location.origin) {
        siteURL = obj.location.origin;
    } else {
        siteURL = obj.location.protocol + '//' + obj.location.hostname + (obj.location.port ? ':' + obj.location.port : '');
    }

    if (siteURL[siteURL.length - 1] === '/') {
        siteURL = siteURL.substring(0, siteURL.length - 1);
    }

    if (obj.basename) {
        siteURL += obj.basename;
    }

    if (siteURL[siteURL.length - 1] === '/') {
        siteURL = siteURL.substring(0, siteURL.length - 1);
    }

    return siteURL;
}

function getSiteURL(): string {
    return getSiteURLFromWindowObject(window);
}

export default class Plugin {
    removeRHSListener?: Unsubscribe;
    activityFunc?: () => void;

    stylesContainer?: Element;

    doRegistrations(registry: PluginRegistry, store: Store<GlobalState>, graphqlClient: ApolloClient<NormalizedCacheObject>): void {
        registry.registerReducer(reducer);

        registry.registerTranslations((locale: string) => {
            try {
                // eslint-disable-next-line global-require
                return require(`../i18n/${locale}.json`); // TODO make async, this increases bundle size exponentially
            } catch {
                return {};
            }
        });

        // eslint-disable-next-line react/require-optimization
        const BackstageWrapped = () => (
            <ApolloWrapper
                component={<Backstage/>}
                client={graphqlClient}
            />
        );

        // eslint-disable-next-line react/require-optimization
        const RHSWrapped = () => (
            <ApolloWrapper
                component={<RightHandSidebar/>}
                client={graphqlClient}
            />
        );
        // eslint-disable-next-line react/require-optimization
        const RHSTitlePlaceholderWrapped = () => (
            <ApolloWrapper
                component={<RHSTitlePlaceholder/>}
                client={graphqlClient}
            />
        );

        const enableTeamSidebar = true;

        registry.registerProduct(
            '/playbooks',
            'product-playbooks',
            'Playbooks',
            '/playbooks',
            BackstageWrapped,
            GlobalHeaderCenter,
            GlobalHeaderRight,
            enableTeamSidebar
        );

        // RHS Registration
        const {toggleRHSPlugin} = registry.registerRightHandSidebarComponent(RHSWrapped, <RHSTitlePlaceholderWrapped/>);
        const boundToggleRHSAction = (): void => store.dispatch(toggleRHSPlugin);

        // Store the toggleRHS action to use later
        store.dispatch(setToggleRHSAction(boundToggleRHSAction));

        // Buttons and menus
        const shouldRender = (state : GlobalState) => getCurrentChannel(state).type !== General.GM_CHANNEL && getCurrentChannel(state).type !== General.DM_CHANNEL;
        registry.registerChannelHeaderButtonAction(ChannelHeaderButton, boundToggleRHSAction, ChannelHeaderText, ChannelHeaderTooltip);
        registry.registerChannelHeaderMenuAction('Channel Actions', () => store.dispatch(showChannelActionsModal()), shouldRender);
        registry.registerPostDropdownMenuComponent(StartPlaybookRunPostMenu);
        registry.registerPostDropdownMenuComponent(AttachToPlaybookRunPostMenu);
        registry.registerRootComponent(PostMenuModal);
        registry.registerRootComponent(ChannelActionsModal);

        // App Bar icon
        if (registry.registerAppBarComponent) {
            const siteUrl = getConfig(store.getState())?.SiteURL || '';
            const iconURL = `${siteUrl}/plugins/${pluginId}/public/app-bar-icon.png`;
            registry.registerAppBarComponent(iconURL, boundToggleRHSAction, ChannelHeaderTooltip);
        }

        // Site statistics handler
        if (registry.registerSiteStatisticsHandler) {
            registry.registerSiteStatisticsHandler(async () => {
                const siteStats = await fetchSiteStats();
                return {
                    playbook_count: {
                        name: <FormattedMessage defaultMessage={'Total Playbooks'}/>,
                        id: 'total_playbooks',
                        icon: 'fa-book', // font-awesome-4.7.0 handler
                        value: siteStats?.total_playbooks,
                    },
                    playbook_run_count: {
                        name: <FormattedMessage defaultMessage={'Total Playbook Runs'}/>,
                        id: 'total_playbook_runs',
                        icon: 'fa-list-alt', // font-awesome-4.7.0 handler
                        value: siteStats?.total_playbook_runs,
                    },
                };
            });
        }

        // Websocket listeners
        registry.registerReconnectHandler(handleReconnect(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RUN_UPDATED, handleWebsocketPlaybookRunUpdated(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RUN_CREATED, handleWebsocketPlaybookRunCreated(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_CREATED, handleWebsocketPlaybookCreated(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_ARCHIVED, handleWebsocketPlaybookArchived(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WEBSOCKET_PLAYBOOK_RESTORED, handleWebsocketPlaybookRestored(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WebsocketEvents.USER_ADDED, handleWebsocketUserAdded(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WebsocketEvents.USER_REMOVED, handleWebsocketUserRemoved(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WebsocketEvents.POST_DELETED, handleWebsocketPostEditedOrDeleted(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WebsocketEvents.POST_EDITED, handleWebsocketPostEditedOrDeleted(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WebsocketEvents.CHANNEL_UPDATED, handleWebsocketChannelUpdated(store.getState, store.dispatch));
        registry.registerWebSocketEventHandler(WebsocketEvents.CHANNEL_VIEWED, handleWebsocketChannelViewed(store.getState, store.dispatch));

        // Local slash commands
        registry.registerSlashCommandWillBePostedHook(makeSlashCommandHook(store));

        // Redirect old routes
        registry.registerNeedsTeamRoute('/error', OldRoutesRedirect);
        registry.registerNeedsTeamRoute('/', OldRoutesRedirect);

        // Custom post types
        registry.registerPostTypeComponent('custom_retro_rem_first', RetrospectiveFirstReminder);
        registry.registerPostTypeComponent('custom_retro_rem', RetrospectiveReminder);
        registry.registerPostTypeComponent('custom_cloud_upgrade', CloudUpgradePost);
        registry.registerPostTypeComponent('custom_run_update', UpdatePost);
        registry.registerPostTypeComponent('custom_update_status', UpdateRequestPost);
        registry.registerPostTypeComponent('custom_retro', RetrospectivePost);

        // Insights handler
        if (registry.registerInsightsHandler) {
            registry.registerInsightsHandler(async (timeRange: string, page: number, perPage: number, teamId: string, insightType: string) => {
                if (insightType === 'MY') {
                    const data = await getMyTopPlaybooks(timeRange, page, perPage, teamId);

                    return data;
                }

                const data = await getTeamTopPlaybooks(timeRange, page, perPage, teamId);

                return data;
            });
        }
    }

    userActivityWatch(): void {
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

        // We have user activity right now because the plugin is loading
        // so fire the first connect event.
        notifyConnect();
    }

    public initialize(registry: PluginRegistry, store: Store<GlobalState>): void {
        this.stylesContainer = document.createElement('div');
        document.body.appendChild(this.stylesContainer);
        render(<><GlobalSelectStyle/></>, this.stylesContainer);

        // Consume the SiteURL so that the client is subpath aware. We also do this for Client4
        // in our version of the mattermost-redux, since webapp only does it in its copy.
        const siteUrl = getSiteURL();
        setSiteUrl(siteUrl);
        Client4.setUrl(siteUrl);

        // Setup our graphql client
        const graphqlClient = makeGraphqlClient();

        // Store graphql client for bad modals.
        setPlaybooksGraphQLClient(graphqlClient);

        this.doRegistrations(registry, store, graphqlClient);

        // Grab global settings
        const getGlobalSettings = async () => {
            store.dispatch(actionSetGlobalSettings(await fetchGlobalSettings()));
        };
        getGlobalSettings();

        // Grab roles
        //@ts-ignore
        store.dispatch(loadRolesIfNeeded([PlaybookRole.Member, PlaybookRole.Admin]));

        this.userActivityWatch();

        // Listen for channel changes and open the RHS when appropriate.
        this.removeRHSListener = store.subscribe(makeRHSOpener(store));
    }

    public uninitialize() {
        if (this.removeRHSListener) {
            this.removeRHSListener();
            delete this.removeRHSListener;
        }
        if (this.activityFunc) {
            document.removeEventListener('click', this.activityFunc);
            delete this.activityFunc;
        }
        if (this.stylesContainer) {
            unmountComponentAtNode(this.stylesContainer);
        }
    }
}

// @ts-ignore
window.registerPlugin(pluginId, new Plugin());
