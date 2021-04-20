// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {GlobalState} from 'mattermost-redux/types/store';
import {GlobalState as WebGlobalState} from 'mattermost-webapp/types/store';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getUsers} from 'mattermost-redux/selectors/entities/common';
import {UserProfile} from 'mattermost-redux/types/users';
import {sortByUsername} from 'mattermost-redux/utils/user_utils';
import {$ID, IDMappedObjects} from 'mattermost-redux/types/utilities';

import {pluginId} from 'src/manifest';
import {
    RHSState,
    RHSTabState,
    TimelineEventsFilter,
    TimelineEventsFilterDefault,
} from 'src/types/rhs';
import {Incident, incidentIsActive} from 'src/types/incident';

//@ts-ignore GlobalState is not complete
const pluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};

export const selectToggleRHS = (state: GlobalState): () => void => pluginState(state).toggleRHSFunction;

export const isIncidentRHSOpen = (state: GlobalState): boolean => pluginState(state).rhsOpen;

export const getIsRhsExpanded = (state: WebGlobalState): boolean => state.views.rhs.isSidebarExpanded;

export const clientId = (state: GlobalState): string => pluginState(state).clientId;

export const isDisabledOnCurrentTeam = (state: GlobalState): boolean => pluginState(state).myIncidentsByTeam[getCurrentTeamId(state)] === false;

// reminder: myIncidentsByTeam indexes teamId->channelId->incident
const myIncidentsByTeam = (state: GlobalState): Record<string, Record<string, Incident>> =>
    pluginState(state).myIncidentsByTeam;

export const inIncidentChannel = createSelector(
    getCurrentTeamId,
    getCurrentChannelId,
    myIncidentsByTeam,
    (teamId, channelId, incidentMapByTeam) => {
        return Boolean(incidentMapByTeam[teamId]?.[channelId]);
    },
);

export const currentIncident = createSelector(
    getCurrentTeamId,
    getCurrentChannelId,
    myIncidentsByTeam,
    (teamId, channelId, incidentMapByTeam) => {
        return incidentMapByTeam[teamId]?.[channelId];
    },
);

export const myActiveIncidentsList = createSelector(
    getCurrentTeamId,
    myIncidentsByTeam,
    (teamId, incidentMapByTeam) => {
        if (!incidentMapByTeam[teamId]) {
            return [];
        }

        // return active incidents, sorted descending by create_at
        return Object.values(incidentMapByTeam[teamId])
            .filter((i) => incidentIsActive(i))
            .sort((a, b) => b.create_at - a.create_at);
    },
);

// myActiveIncidentsMap returns a map indexed by channelId->incident for the current team
export const myIncidentsMap = (state: GlobalState) => {
    return myIncidentsByTeam(state)[getCurrentTeamId(state)] || {};
};

export const isExportLicensed = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return license?.IsLicensed === 'true' && license?.MessageExport === 'true';
};

export const currentRHSState = (state: GlobalState): RHSState => pluginState(state).rhsState;

export const currentRHSTabState = (state: GlobalState): RHSTabState => {
    const channelId = getCurrentChannelId(state);
    return pluginState(state).tabStateByChannel[channelId] || RHSTabState.ViewingAbout;
};

export const currentRHSEventsFilter = (state: GlobalState): TimelineEventsFilter => {
    const channelId = getCurrentChannelId(state);
    return pluginState(state).eventsFilterByChannel[channelId] || TimelineEventsFilterDefault;
};

export const rhsEventsFilterForChannel = (state: GlobalState, channelId: string): TimelineEventsFilter => {
    return pluginState(state).eventsFilterByChannel[channelId] || TimelineEventsFilterDefault;
};

export const lastUpdatedByIncidentId = createSelector(
    getCurrentTeamId,
    myIncidentsByTeam,
    (teamId, incidentsMapByTeam) => {
        const result = {} as Record<string, number>;
        const incidentMap = incidentsMapByTeam[teamId];
        for (const incident of Object.values(incidentMap)) {
            result[incident.id] = findLastUpdated(incident);
        }
        return result;
    },
);

const findLastUpdated = (incident: Incident) => {
    const posts = [...incident.status_posts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);
    return posts.length === 0 ? 0 : posts[0].create_at;
};

const PROFILE_SET_ALL = 'all';

// sortAndInjectProfiles is an unexported function copied from mattermost-redux, it is called
// whenever a function returns a populated list of UserProfiles. Since getProfileSetForChannel is
// new, we have to sort and inject profiles before returning the list.
function sortAndInjectProfiles(profiles: IDMappedObjects<UserProfile>, profileSet?: 'all' | Array<$ID<UserProfile>> | Set<$ID<UserProfile>>): Array<UserProfile> {
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

const numPlaybooksByTeam = (state: GlobalState): Record<string, number> =>
    pluginState(state).numPlaybooksByTeam;

export const currentTeamNumPlaybooks = createSelector(
    getCurrentTeamId,
    numPlaybooksByTeam,
    (teamId, playbooksPerTeamMap) => {
        return playbooksPerTeamMap[teamId] || 0;
    },
);
