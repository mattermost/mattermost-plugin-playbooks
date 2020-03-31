// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'mattermost-redux/types/store';

import {pluginId} from './manifest';
import {Incident} from './types/incident';

const getPluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};

export const activeIncidents = (state: GlobalState) => {
    const incidents = getPluginState(state).incidents;

    return incidents ? incidents.filter((incident: Incident) => incident.is_active) : [];
};

export const incidentDetails = (state: GlobalState) => {
    return getPluginState(state).incidentDetails || {};
};

export const getShowRHSAction = (state: GlobalState) => getPluginState(state).rhsPluginAction;

export const getRHSState = (state: GlobalState) => getPluginState(state).rhsState;

export const getRHSOpen = (state: GlobalState) => getPluginState(state).rhsOpen;
