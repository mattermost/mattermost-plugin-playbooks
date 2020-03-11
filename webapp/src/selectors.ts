import {GlobalState} from 'mattermost-redux/types/store';

import {id as pluginId} from './manifest';
import {Incident} from './types/incident';

const getPluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};

export const activeIncidents = (state: GlobalState) => {
    const incidents = getPluginState(state).incidents;

    return incidents ? incidents.filter((incident: Incident) => incident.state === 0) : [];
};

export const getShowRHSAction = (state: GlobalState) => getPluginState(state).rhsPluginAction;

