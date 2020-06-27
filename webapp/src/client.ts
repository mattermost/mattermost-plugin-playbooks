// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {GetStateFunc} from 'mattermost-redux/types/actions';
import {UserProfile} from 'mattermost-redux/types/users';
import {AnyAction, Dispatch} from 'redux';
import qs from 'qs';

import {Client4} from 'mattermost-redux/client';
import {ClientError} from 'mattermost-redux/client/client4';

import {setTriggerId} from 'src/actions';
import {CommanderInfo} from 'src/types/backstage';
import {FetchIncidentsParams, FetchIncidentsReturn, Incident} from 'src/types/incident';
import {Playbook, ChecklistItem} from 'src/types/playbook';

import {pluginId} from './manifest';

const apiUrl = `/plugins/${pluginId}/api/v1`;

export async function fetchIncidents(params: FetchIncidentsParams) {
    const queryParams = qs.stringify(params, {addQueryPrefix: true});

    let data = await doGet(`${apiUrl}/incidents${queryParams}`);
    if (!data) {
        data = {incidents: [], total_count: 0};
    }
    if (!data.incidents) {
        data.incidents = [];
    }
    return data as FetchIncidentsReturn;
}

export function fetchIncident(id: string) {
    return doGet(`${apiUrl}/incidents/${id}`);
}

export function fetchIncidentWithDetails(id: string) {
    return doGet(`${apiUrl}/incidents/${id}/details`);
}

export function fetchIncidentWithDetailsByChannel(channelId: string) {
    return doGet(`${apiUrl}/incidents/channel/${channelId}`);
}

export async function clientExecuteCommand(dispatch: Dispatch<AnyAction>, getState: GetStateFunc, command: string) {
    const currentChannel = getCurrentChannel(getState());
    const currentTeamId = getCurrentTeamId(getState());

    const args = {
        channel_id: currentChannel?.id,
        team_id: currentTeamId,
    };

    try {
        const data = await Client4.executeCommand(command, args);
        dispatch(setTriggerId(data?.trigger_id));
    } catch (error) {
        console.error(error); //eslint-disable-line no-console
    }
}

export function clientFetchPlaybooks(teamID: string) {
    return doGet(`${apiUrl}/playbooks?teamid=${teamID}`);
}

export function clientFetchPlaybook(playbookID: string) {
    return doGet(`${apiUrl}/playbooks/${playbookID}`);
}

export async function savePlaybook(playbook: Playbook) {
    if (!playbook.id) {
        const {data} = await doPost(`${apiUrl}/playbooks`, JSON.stringify(playbook));
        return data;
    }

    const {data} = await doFetchWithResponse(`${apiUrl}/playbooks/${playbook.id}`, {
        method: 'put',
        body: JSON.stringify(playbook),
    });

    return data;
}

export async function deletePlaybook(playbook: Playbook) {
    try {
        return await doFetchWithResponse(`${apiUrl}/playbooks/${playbook.id}`, {
            method: 'delete',
        });
    } catch (error) {
        return {error};
    }
}

export async function fetchUsersInChannel(channelId: string): Promise<UserProfile[]> {
    return Client4.getProfilesInChannel(channelId, 0, 200);
}

export async function fetchCommandersInTeam(teamId: string): Promise<CommanderInfo[]> {
    const queryParams = qs.stringify({team_id: teamId}, {addQueryPrefix: true});

    let data = await doGet(`${apiUrl}/incidents/commanders${queryParams}`);
    if (!data) {
        data = [];
    }
    return data as CommanderInfo[];
}

export async function setCommander(incidentId: string, commanderId: string) {
    const body = `{"commander_id": "${commanderId}"}`;
    try {
        const data = await doPost(`${apiUrl}/incidents/${incidentId}/commander`, body);
        return data;
    } catch (error) {
        return {error};
    }
}

export async function checkItem(incidentID: string, checklistNum: number, itemNum: number) {
    const {data} = await doFetchWithResponse(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/item/${itemNum}/check`, {
        method: 'put',
        body: '',
    });

    return data;
}

export async function uncheckItem(incidentID: string, checklistNum: number, itemNum: number) {
    const {data} = await doFetchWithResponse(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/item/${itemNum}/uncheck`, {
        method: 'put',
        body: '',
    });

    return data;
}

export async function clientAddChecklistItem(incidentID: string, checklistNum: number, checklistItem: ChecklistItem) {
    const {data} = await doFetchWithResponse(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/add`, {
        method: 'put',
        body: JSON.stringify(checklistItem),
    });

    return data;
}

export async function clientRemoveChecklistItem(incidentID: string, checklistNum: number, itemNum: number) {
    const {data} = await doFetchWithResponse(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/item/${itemNum}`, {
        method: 'delete',
        body: '',
    });

    return data;
}

export async function clientRenameChecklistItem(incidentID: string, checklistNum: number, itemNum: number, newTitle: string) {
    const {data} = await doFetchWithResponse(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/item/${itemNum}`, {
        method: 'put',
        body: JSON.stringify({
            title: newTitle,
        }),
    });

    return data;
}

export async function clientReorderChecklist(incidentID: string, checklistNum: number, itemNum: number, newLocation: number) {
    const {data} = await doFetchWithResponse(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/reorder`, {
        method: 'put',
        body: JSON.stringify({
            item_num: itemNum,
            new_location: newLocation,
        }),
    });

    return data;
}

export function exportChannelUrl(channelId: string) {
    const exportPluginUrl = '/plugins/com.mattermost.plugin-channel-export/api/v1';

    const queryParams = qs.stringify({
        channel_id: channelId,
        format: 'csv',
    }, {addQueryPrefix: true});

    return `${exportPluginUrl}/export${queryParams}`;
}

export const doGet = async (url: string) => {
    const {data} = await doFetchWithResponse(url, {method: 'get'});

    return data;
};

export const doPost = async (url: string, body = {}) => {
    const {data} = await doFetchWithResponse(url, {
        method: 'post',
        body,
    });

    return data;
};

export const doFetchWithResponse = async (url: string, options = {}) => {
    const response = await fetch(url, Client4.getOptions(options));

    let data;
    if (response.ok) {
        data = await response.json();

        return {
            response,
            data,
        };
    }

    data = await response.text();

    throw new ClientError(Client4.url, {
        message: data || '',
        status_code: response.status,
        url,
    });
};

export const doFetchWithTextResponse = async (url: string, options = {}) => {
    const response = await fetch(url, Client4.getOptions(options));

    let data;
    if (response.ok) {
        data = await response.text();

        return {
            response,
            data,
        };
    }

    data = await response.text();

    throw new ClientError(Client4.url, {
        message: data || '',
        status_code: response.status,
        url,
    });
};
