// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {id as pluginId} from '../manifest';

import {Incident} from './incident';

export const RECEIVED_SHOW_RHS_ACTION = pluginId + '_show_rhs';
export const RECEIVED_INCIDENTS = pluginId + '_received_incidents';

export interface ReceivedShowRHSAction {
    type: typeof RECEIVED_SHOW_RHS_ACTION;
    showRHSPluginAction: () => void;
}

export interface ReceivedIncidents {
    type: typeof RECEIVED_INCIDENTS;
    incidents: Incident [];
}