// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'mattermost-redux/types/store';
import {createSelector} from 'reselect';

import {pluginId} from './manifest';
import {Incident} from './types/incident';

const getPluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};
const getIncidents = (state: GlobalState) => getPluginState(state).incidents;

export const activeIncidents = createSelector(getIncidents,
    (incidents) => {
        const list = incidents ? incidents.filter((incident: Incident) => incident.is_active) : [];
        return sortedDescending(list);
    }
);

const sortedDescending = (incidents: Incident[]) => {
    return incidents.sort((a, b) => {
        return b.created_at - a.created_at;
    });
};

export const incidentDetails = (state: GlobalState) => {
    return getPluginState(state).incidentDetails || {};
};

export const getShowRHSAction = (state: GlobalState) => getPluginState(state).rhsPluginAction;

export const getRHSState = (state: GlobalState) => getPluginState(state).rhsState;

export const isLoading = (state: GlobalState) => getPluginState(state).isLoading;

export const getRHSOpen = (state: GlobalState) => getPluginState(state).rhsOpen;

export const getClientId = (state: GlobalState) => getPluginState(state).clientId;

