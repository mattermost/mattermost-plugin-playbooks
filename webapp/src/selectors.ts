// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {GlobalState} from 'mattermost-redux/types/store';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {pluginId} from 'src/manifest';
import {RHSState} from 'src/types/rhs';
import {Incident} from 'src/types/incident';

//@ts-ignore GlobalState is not complete
const pluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};

export const selectToggleRHS = (state: GlobalState): () => void => pluginState(state).toggleRHSFunction;

export const isIncidentRHSOpen = (state: GlobalState): boolean => pluginState(state).rhsOpen;

export const clientId = (state: GlobalState): string => pluginState(state).clientId;

export const isIncidentChannel = (state: GlobalState, channelId: string): boolean => {
    return Boolean(pluginState(state).myChannelIdToIncidents[channelId]);
};

const myChannelIdToIncidents = (state: GlobalState): Record<string, Incident> => pluginState(state).myChannelIdToIncidents;

export const myActiveIncidentsList = createSelector(
    myChannelIdToIncidents,
    (channelIdToIncidents) => {
        const incidents = [] as Incident[];
        for (const incident of Object.values<Incident>(channelIdToIncidents)) {
            if (incident.is_active) {
                incidents.push(incident);
            }
        }

        // return descending by create_at
        return incidents.sort((a, b) => b.create_at - a.create_at);
    },
);

export const isExportLicensed = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return license?.IsLicensed === 'true' && license?.MessageExport === 'true';
};

export const currentRHSState = (state: GlobalState): RHSState => pluginState(state).rhsState;

export const currentlyFetchingIncidents = (state: GlobalState): boolean => pluginState(state).fetchingIncidents;
