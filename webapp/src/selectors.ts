// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import General from 'mattermost-redux/constants/general';
import {GlobalState} from 'mattermost-redux/types/store';
import {GlobalState as WebGlobalState} from 'mattermost-webapp/types/store';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getUsers, getMyCurrentChannelMembership} from 'mattermost-redux/selectors/entities/common';
import {UserProfile} from 'mattermost-redux/types/users';
import {sortByUsername} from 'mattermost-redux/utils/user_utils';
import {IDMappedObjects} from 'mattermost-redux/types/utilities';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {
    haveIChannelPermission,
    haveISystemPermission,
    haveITeamPermission,
} from 'mattermost-redux/selectors/entities/roles';

import Permissions from 'mattermost-redux/constants/permissions';

import {Team} from 'mattermost-webapp/packages/mattermost-redux/src/types/teams';

import {pluginId} from 'src/manifest';
import {playbookRunIsActive, PlaybookRun} from 'src/types/playbook_run';
import {RHSState, TimelineEventsFilter, TimelineEventsFilterDefault} from 'src/types/rhs';
import {findLastUpdated} from 'src/utils';
import {GlobalSettings} from 'src/types/settings';
import {ChecklistItemsFilter, ChecklistItemsFilterDefault} from 'src/types/playbook';
import {PlaybooksPluginState} from 'src/reducer';

// Assert known typing
const pluginState = (state: GlobalState): PlaybooksPluginState => state['plugins-' + pluginId as keyof GlobalState] as unknown as PlaybooksPluginState || {} as PlaybooksPluginState;

export const selectToggleRHS = (state: GlobalState): () => void => pluginState(state).toggleRHSFunction;

export const isPlaybookRunRHSOpen = (state: GlobalState): boolean => pluginState(state).rhsOpen;

export const getIsRhsExpanded = (state: WebGlobalState): boolean => state.views.rhs.isSidebarExpanded;

export const getAdminAnalytics = (state: GlobalState): Record<string, number> => state.entities.admin.analytics as Record<string, number>;

export const clientId = (state: GlobalState): string => pluginState(state).clientId;

export const globalSettings = (state: GlobalState): GlobalSettings | null => pluginState(state).globalSettings;

/**
 * @returns runs indexed by teamId->{channelId->playbookRun}
 */
export const myPlaybookRunsByTeam = (state: GlobalState) => pluginState(state).myPlaybookRunsByTeam;

export const canIPostUpdateForRun = (state: GlobalState, channelId: string, teamId: string) => {
    const canPost = haveIChannelPermission(state, teamId, channelId, Permissions.READ_CHANNEL);

    const canManageSystem = haveISystemPermission(state, {
        channel: channelId,
        team: teamId,
        permission: Permissions.MANAGE_SYSTEM,
    });

    return canPost || canManageSystem;
};

export const inPlaybookRunChannel = createSelector(
    'inPlaybookRunChannel',
    getCurrentTeamId,
    getCurrentChannelId,
    myPlaybookRunsByTeam,
    (teamId, channelId, playbookRunMapByTeam) => {
        return Boolean(playbookRunMapByTeam[teamId]?.[channelId]);
    },
);

export const getPlaybookRunByTeamAndChannelId = (state: GlobalState, teamId: string, channelId: string): PlaybookRun | undefined => (
    myPlaybookRunsByTeam(state)[teamId]?.[channelId]
);

export const currentPlaybookRun = createSelector(
    'currentPlaybookRun',
    getCurrentTeamId,
    getCurrentChannelId,
    myPlaybookRunsByTeam,
    (teamId, channelId, playbookRunMapByTeam) => {
        return playbookRunMapByTeam[teamId]?.[channelId];
    },
);

const emptyChecklistState = {} as Record<number, boolean>;

export const currentChecklistCollapsedState = createSelector(
    'currentChecklistCollapsedState',
    getCurrentChannelId,
    pluginState,
    (channelId, plugin) => {
        return plugin.checklistCollapsedState[channelId] ?? emptyChecklistState;
    },
);

export const currentChecklistAllCollapsed = createSelector(
    'currentChecklistAllCollapsed',
    currentPlaybookRun,
    currentChecklistCollapsedState,
    (playbookRun, checklistsState) => {
        if (!playbookRun) {
            return true;
        }
        for (let i = 0; i < playbookRun.checklists.length; i++) {
            if (!checklistsState[i]) {
                return false;
            }
        }
        return true;
    },
);

export const currentChecklistItemsFilter = (state: GlobalState): ChecklistItemsFilter => {
    const channelId = getCurrentChannelId(state);
    return pluginState(state).checklistItemsFilterByChannel[channelId] || ChecklistItemsFilterDefault;
};

export const myActivePlaybookRunsList = createSelector(
    'myActivePlaybookRunsList',
    getCurrentTeamId,
    myPlaybookRunsByTeam,
    (teamId, playbookRunMapByTeam) => {
        const runMap = playbookRunMapByTeam[teamId];
        if (!runMap) {
            return [];
        }

        // return active playbook runs, sorted descending by create_at
        return Object.values(runMap)
            .filter((i) => playbookRunIsActive(i))
            .sort((a, b) => b.create_at - a.create_at);
    },
);

// myActivePlaybookRunsMap returns a map indexed by channelId->playbookRun for the current team
export const myPlaybookRunsMap = (state: GlobalState) => {
    return myPlaybookRunsByTeam(state)[getCurrentTeamId(state)] || {};
};

export const currentRHSState = (state: GlobalState): RHSState => pluginState(state).rhsState;

export const currentRHSEventsFilter = (state: GlobalState): TimelineEventsFilter => {
    const channelId = getCurrentChannelId(state);
    return pluginState(state).eventsFilterByChannel[channelId] || TimelineEventsFilterDefault;
};

export const rhsEventsFilterForChannel = (state: GlobalState, channelId: string): TimelineEventsFilter => {
    return pluginState(state).eventsFilterByChannel[channelId] || TimelineEventsFilterDefault;
};

export const lastUpdatedByPlaybookRunId = createSelector(
    'lastUpdatedByPlaybookRunId',
    getCurrentTeamId,
    myPlaybookRunsByTeam,
    (teamId, playbookRunsMapByTeam) => {
        const result = {} as Record<string, number>;
        const playbookRunMap = playbookRunsMapByTeam[teamId];
        if (!playbookRunMap) {
            return {};
        }
        for (const playbookRun of Object.values(playbookRunMap)) {
            result[playbookRun.id] = findLastUpdated(playbookRun);
        }
        return result;
    },
);

const PROFILE_SET_ALL = 'all';

// sortAndInjectProfiles is an unexported function copied from mattermost-redux, it is called
// whenever a function returns a populated list of UserProfiles. Since getProfileSetForChannel is
// new, we have to sort and inject profiles before returning the list.
function sortAndInjectProfiles(profiles: IDMappedObjects<UserProfile>, profileSet?: 'all' | Array<UserProfile['id']> | Set<UserProfile['id']>): Array<UserProfile> {
    let currentProfiles: UserProfile[] = [];

    if (typeof profileSet === 'undefined') {
        return currentProfiles;
    } else if (profileSet === PROFILE_SET_ALL) {
        currentProfiles = Object.keys(profiles).map((key) => profiles[key]);
    } else {
        currentProfiles = Array.from(profileSet).map((p) => profiles[p]);
    }

    currentProfiles = currentProfiles.filter((profile) => Boolean(profile));

    return currentProfiles.sort(sortByUsername);
}

export const getProfileSetForChannel = (state: GlobalState, channelId: string) => {
    const profileSet = state.entities.users.profilesInChannel[channelId];
    const profiles = getUsers(state);
    return sortAndInjectProfiles(profiles, profileSet);
};

export const isPostMenuModalVisible = (state: GlobalState): boolean =>
    pluginState(state).postMenuModalVisibility;

export const isChannelActionsModalVisible = (state: GlobalState): boolean =>
    pluginState(state).channelActionsModalVisibility;

export const isRunActionsModalVisible = (state: GlobalState): boolean =>
    pluginState(state).runActionsModalVisibility;

export const isCurrentUserAdmin = createSelector(
    'isCurrentUserAdmin',
    getCurrentUser,
    (user) => {
        const rolesArray = user.roles.split(' ');
        return rolesArray.includes(General.SYSTEM_ADMIN_ROLE);
    },
);

export const isCurrentUserChannelAdmin = createSelector(
    'isCurrentUserChannelAdmin',
    getMyCurrentChannelMembership,
    (membership) => {
        return membership?.scheme_admin || false;
    },
);

export const hasViewedByChannelID = (state: GlobalState) => pluginState(state).hasViewedByChannel;

export const isTeamEdition = createSelector(
    'isTeamEdition',
    getConfig,
    (config) => config.BuildEnterpriseReady !== 'true',
);

const rhsAboutCollapsedState = (state: GlobalState): Record<string, boolean> => pluginState(state).rhsAboutCollapsedByChannel;

export const currentRHSAboutCollapsedState = createSelector(
    'currentRHSAboutCollapsedState',
    getCurrentChannelId,
    rhsAboutCollapsedState,
    (channelId, stateByChannel) => {
        return stateByChannel[channelId] ?? false;
    },
);

export const selectTeamsIHavePermissionToMakePlaybooksOn = (state: GlobalState) => {
    return getMyTeams(state).filter((team: Team) => (
        haveITeamPermission(state, team.id, 'playbook_public_create') ||
		haveITeamPermission(state, team.id, 'playbook_private_create')
    ));
};

export const selectExperimentalFeatures = (state: GlobalState) => Boolean(globalSettings(state)?.enable_experimental_features);
