// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Dispatch, AnyAction} from 'redux';

import {getUser as fetchUser} from 'mattermost-redux/actions/users';
import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {getTeam as fetchTeam} from 'mattermost-redux/actions/teams';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam, getCurrentTeamId, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {generateId} from 'mattermost-redux/utils/helpers';

import {Channel} from 'mattermost-redux/types/channels';
import {IntegrationTypes} from 'mattermost-redux/action_types';

import {GetStateFunc} from 'mattermost-redux/types/actions';

import {ChecklistItem} from 'src/types/playbook';
import {selectToggleRHS, backstage} from 'src/selectors';
import {pluginId} from 'src/manifest';

import {
    RECEIVED_TOGGLE_RHS_ACTION,
    RECEIVED_RHS_STATE,
    SET_RHS_OPEN,
    RECEIVED_INCIDENTS,
    RECEIVED_INCIDENT_DETAILS,
    RECEIVED_INCIDENT_UPDATE,
    RECEIVED_ERROR,
    SET_LOADING,
    SET_CLIENT_ID,
    ReceivedToggleRHSAction,
    SetRHSOpen,
    ReceivedIncidents,
    ReceivedIncidentDetails,
    ReceivedError,
    ReceivedRHSState,
    SetTriggerId,
    ReceivedIncidentUpdate,
    SetLoading,
    SetClientId,
    ReceivedPlaybooks,
    SetBackstageSettings,
    SET_BACKSTAGE_SETTINGS,
    RECEIVED_PLAYBOOKS,
    RECEIVED_PLAYBOOK,
    REMOVE_PLAYBOOK,
    ReceivedPlaybook,
} from './types/actions';

import {Incident} from './types/incident';
import {RHSState} from './types/rhs';
import {Playbook} from './types/playbook';
import {BackstageArea} from './types/backstage';

import {
    fetchIncidents,
    fetchIncident,
    clientExecuteCommand,
    checkItem,
    uncheckItem,
    clientAddChecklistItem,
    clientRemoveChecklistItem,
    clientRenameChecklistItem,
    clientReorderChecklist,
    clientFetchPlaybook,
    clientFetchPlaybooks,
    fetchIncidentWithDetails,
} from './client';

// @ts-ignore
const WebappUtils = window.WebappUtils;

export function getIncident(id: string) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        try {
            // Fetch incident
            const incident = await fetchIncident(id) as Incident;

            // Fetch commander
            if (!getUser(getState(), incident.commander_user_id)) {
                dispatch(fetchUser(incident.commander_user_id));
            }

            // Fetch primary channel and team data
            let c = getChannel(getState(), incident.primary_channel_id) as Channel;
            if (!c) {
                // Must wait to fetch channel data before fetching its team data
                /* eslint-disable no-await-in-loop */
                c = await dispatch(fetchChannel(incident.primary_channel_id)) as Channel;
            }
            if (!getTeam(getState(), c.team_id)) {
                dispatch(fetchTeam(c.team_id));
            }

            dispatch(receivedIncidentDetails(incident));
        } catch (error) {
            dispatch(receivedError(error));
        }
    };
}

export function getIncidentWithDetails(id: String) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        try {
            const incident = await fetchIncidentWithDetails(id) as Incident;
            dispatch(receivedIncidentDetails(incident));
        } catch {
            dispatch(getIncident(id));
        }
    };
}

export function getIncidentsForCurrentTeam() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        dispatch(getIncidents(getCurrentTeamId(getState())));
    };
}

/**
 * Fetches incident headers.
 * @param teamId Gets all incidents if teamId is null.
 */
export function getIncidents(teamId?: string) {
    return async (dispatch: Dispatch<AnyAction>) => {
        try {
            const incidentsReturn = await fetchIncidents({team_id: teamId});

            dispatch(receivedIncidents(incidentsReturn.incidents, teamId));
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function startIncident(postId?: string) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        // Add unique id
        const clientId = generateId();
        dispatch(setClientId(clientId));

        let command = `/incident start ${clientId}`;
        if (postId) {
            command = `${command} ${postId}`;
        }

        await clientExecuteCommand(dispatch, getState, command);
    };
}

export function endIncident() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, '/incident end');
    };
}

export function getPlaybooksForTeam(teamID: string) {
    return async (dispatch: Dispatch<AnyAction>) => {
        try {
            const playbooks = await clientFetchPlaybooks(teamID);
            dispatch(receivedPlaybooks(teamID, playbooks));
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function getPlaybooksForCurrentTeam() {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        dispatch(getPlaybooksForTeam(getCurrentTeamId(getState())));
    };
}

export function getPlaybook(playbookID: string) {
    return async (dispatch: Dispatch<AnyAction>) => {
        try {
            const playbook = await clientFetchPlaybook(playbookID);
            dispatch(receivedPlaybook(playbook));
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function modifyChecklistItemState(incidentID: string, checklistNum: number, itemNum: number, checked: boolean) {
    return async () => {
        try {
            if (checked) {
                checkItem(incidentID, checklistNum, itemNum);
            } else {
                uncheckItem(incidentID, checklistNum, itemNum);
            }
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function addChecklistItem(incidentID: string, checklistNum: number, checklistItem: ChecklistItem) {
    return async () => {
        try {
            await clientAddChecklistItem(incidentID, checklistNum, checklistItem);
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function removeChecklistItem(incidentID: string, checklistNum: number, itemNum: number) {
    return async () => {
        try {
            await clientRemoveChecklistItem(incidentID, checklistNum, itemNum);
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function renameChecklistItem(incidentID: string, checklistNum: number, itemNum: number, newTitle: string) {
    return async () => {
        try {
            await clientRenameChecklistItem(incidentID, checklistNum, itemNum, newTitle);
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function reorderChecklist(incidentID: string, checklistNum: number, itemNum: number, newLocation: number) {
    return async () => {
        try {
            await clientReorderChecklist(incidentID, checklistNum, itemNum, newLocation);
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}

export function withLoading(action: any) {
    return async (dispatch: Dispatch<AnyAction>) => {
        dispatch(setLoading(true));
        await dispatch(action);
        dispatch(setLoading(false));
    };
}

export function setRHSOpen(open: boolean): SetRHSOpen {
    return {
        type: SET_RHS_OPEN,
        open,
    };
}

function receivedIncidents(incidents: Incident[], teamId?: string): ReceivedIncidents {
    return {
        type: RECEIVED_INCIDENTS,
        incidents,
        teamId,
    };
}

function receivedIncidentDetails(incidentDetails: Incident): ReceivedIncidentDetails {
    return {
        type: RECEIVED_INCIDENT_DETAILS,
        incidentDetails,
    };
}

export function receivedIncidentUpdate(incident: Incident): ReceivedIncidentUpdate {
    return {
        type: RECEIVED_INCIDENT_UPDATE,
        incident,
    };
}

function receivedError(error: string): ReceivedError {
    return {
        type: RECEIVED_ERROR,
        error,
    };
}

/**
 * Stores`showRHSPlugin` action returned by
 * registerRightHandSidebarComponent in plugin initialization.
 */
export function setToggleRHSAction(toggleRHSPluginAction: () => void): ReceivedToggleRHSAction {
    return {
        type: RECEIVED_TOGGLE_RHS_ACTION,
        toggleRHSPluginAction,
    };
}

export function setRHSState(state: RHSState): ReceivedRHSState {
    return {
        type: RECEIVED_RHS_STATE,
        state,
    };
}

export function setTriggerId(triggerId: string): SetTriggerId {
    return {
        type: IntegrationTypes.RECEIVED_DIALOG_TRIGGER_ID,
        data: triggerId,
    };
}

function setLoading(isLoading: boolean): SetLoading {
    return {
        type: SET_LOADING,
        isLoading,
    };
}

export function setClientId(clientId: string): SetClientId {
    return {
        type: SET_CLIENT_ID,
        clientId,
    };
}

function receivedPlaybooks(teamID: string, playbooks: Playbook[]): ReceivedPlaybooks {
    return {
        type: RECEIVED_PLAYBOOKS,
        teamID,
        playbooks,
    };
}

export function receivedPlaybook(playbook: Playbook): ReceivedPlaybook {
    return {
        type: RECEIVED_PLAYBOOK,
        playbook,
    };
}

export function removePlaybook(playbook: Playbook): ReceivedPlaybook {
    return {
        type: REMOVE_PLAYBOOK,
        playbook,
    };
}

export function toggleRHS() {
    return (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        selectToggleRHS(getState())();
    };
}

export function navigateToUrl(urlPath: string) {
    return (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        WebappUtils.browserHistory.push(urlPath);
    };
}

export function navigateToTeamPluginUrl(urlPath: string) {
    return (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        let cleanPath = urlPath;
        while (cleanPath.startsWith('/')) {
            cleanPath = cleanPath.substr(1);
        }
        const team = getCurrentTeam(getState());
        WebappUtils.browserHistory.push(`/${team.name}/${pluginId}/` + cleanPath);
    };
}
