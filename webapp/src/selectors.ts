// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'mattermost-redux/types/store';
import {createSelector} from 'reselect';

import {pluginId} from './manifest';
import {Incident} from './types/incident';

const pluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};
const allIncidents = (state: GlobalState) => pluginState(state).incidents;

export const activeIncidents = createSelector(allIncidents,
    (incidents) => {
        const list = incidents ? incidents.filter((incident: Incident) => incident.is_active) : [];
        return sortedDescending(list);
    },
);

const sortedDescending = (incidents: Incident[]) => {
    return incidents.sort((a, b) => {
        return b.created_at - a.created_at;
    });
};

export const incidentDetails = (state: GlobalState) => {
    return pluginState(state).incidentDetails || {};
};

export const toggleRHS = (state: GlobalState) => pluginState(state).toggleRHSFunction;

export const rhsState = (state: GlobalState) => pluginState(state).rhsState;

export const rhsOpen = (state: GlobalState) => pluginState(state).rhsOpen;

export const isLoading = (state: GlobalState) => pluginState(state).isLoading;

export const clientId = (state: GlobalState) => pluginState(state).clientId;
