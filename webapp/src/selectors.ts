// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'mattermost-redux/types/store';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {RHSState} from 'src/types/rhs';
import {pluginId} from './manifest';

//@ts-ignore GlobalState is not complete
const pluginState = (state: GlobalState) => state['plugins-' + pluginId] || {};

export const selectToggleRHS = (state: GlobalState): () => void => pluginState(state).toggleRHSFunction;

export const isIncidentRHSOpen = (state: GlobalState): boolean => pluginState(state).rhsOpen;

export const clientId = (state: GlobalState): string => pluginState(state).clientId;

export const isIncidentChannel = (state: GlobalState, channelId: string): boolean => pluginState(state).myIncidentChannelIds.has(channelId);

export const isExportLicensed = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return license?.IsLicensed === 'true' && license?.MessageExport === 'true';
};

export const currentRHSState = (state: GlobalState): RHSState => pluginState(state).rhsState;
