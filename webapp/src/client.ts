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
import {
    FetchIncidentsParams,
    FetchIncidentsReturn,
    isMetadata,
    Metadata,
    isIncident,
    Incident,
} from 'src/types/incident';
import {
    Playbook,
    ChecklistItem,
    ChecklistItemState,
    FetchPlaybooksNoChecklistReturn,
    PlaybookNoChecklist,
} from 'src/types/playbook';

import {pluginId} from './manifest';

const apiUrl = `/plugins/${pluginId}/api/v0`;

export async function fetchIncidents(params: FetchIncidentsParams) {
    const queryParams = qs.stringify(params, {addQueryPrefix: true});

    let data = await doGet(`${apiUrl}/incidents${queryParams}`);
    if (!data) {
        data = {items: [], total_count: 0, page_count: 0, has_more: false} as FetchIncidentsReturn;
    }

    return data as FetchIncidentsReturn;
}

export async function fetchIncident(id: string) {
    const data = await doGet(`${apiUrl}/incidents/${id}`);
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV !== 'production') {
        if (!isIncident(data)) {
            // eslint-disable-next-line no-console
            console.error('expected an Incident in fetchIncident, received:', data);
        }
    }

    return data as Incident;
}

export async function fetchIncidentMetadata(id: string) {
    const data = await doGet(`${apiUrl}/incidents/${id}/metadata`);
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV !== 'production') {
        if (!isMetadata(data)) {
            // eslint-disable-next-line no-console
            console.error('expected a Metadata in fetchIncidentMetadata, received:', data);
        }
    }

    return data as Metadata;
}

export async function fetchIncidentByChannel(channelId: string) {
    const data = await doGet(`${apiUrl}/incidents/channel/${channelId}`);
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV !== 'production') {
        if (!isIncident(data)) {
            // eslint-disable-next-line no-console
            console.error('expected an Incident in fetchIncident, received:', data);
        }
    }

    return data as Incident;
}

export function fetchIncidentChannels(teamID: string, userID: string) {
    return doGet(`${apiUrl}/incidents/channels?team_id=${teamID}&member_id=${userID}`);
}

export async function clientExecuteCommand(dispatch: Dispatch<AnyAction>, getState: GetStateFunc, command: string) {
    const currentChannel = getCurrentChannel(getState());
    const currentTeamId = getCurrentTeamId(getState());

    const args = {
        channel_id: currentChannel?.id,
        team_id: currentTeamId,
    };

    try {
        //@ts-ignore Typing in mattermost-redux is wrong
        const data = await Client4.executeCommand(command, args);
        dispatch(setTriggerId(data?.trigger_id));
    } catch (error) {
        console.error(error); //eslint-disable-line no-console
    }
}

export async function clientRunChecklistItemSlashCommand(incidentId: string, checklistNumber: number, itemNumber: number) {
    try {
        await doPost(`${apiUrl}/incidents/${incidentId}/checklists/${checklistNumber}/item/${itemNumber}/run`);
    } catch (error) {
        console.error(error); //eslint-disable-line no-console
    }
}

export function clientFetchPlaybooks(teamID: string, params: FetchIncidentsParams) {
    const queryParams = qs.stringify({
        team_id: teamID,
        ...params,
    }, {addQueryPrefix: true});
    return doGet(`${apiUrl}/playbooks${queryParams}`);
}

const clientHasPlaybooks = async (teamID: string): Promise<boolean> => {
    const result = await clientFetchPlaybooks(teamID, {
        page: 0,
        per_page: 1,
    }) as FetchPlaybooksNoChecklistReturn;

    return result.items?.length > 0;
};

export {clientHasPlaybooks};

export function clientFetchPlaybook(playbookID: string) {
    return doGet(`${apiUrl}/playbooks/${playbookID}`);
}

export async function savePlaybook(playbook: Playbook) {
    if (!playbook.id) {
        const {data} = await doPost(`${apiUrl}/playbooks`, JSON.stringify(playbook));
        return data;
    }

    const {data} = await doPut(`${apiUrl}/playbooks/${playbook.id}`,
        JSON.stringify(playbook),
    );

    return data;
}

export async function deletePlaybook(playbook: PlaybookNoChecklist) {
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

export async function setAssignee(incidentId: string, checklistNum: number, itemNum: number, assigneeId?: string) {
    const body = JSON.stringify({assignee_id: assigneeId});
    try {
        const data = await doPut(`${apiUrl}/incidents/${incidentId}/checklists/${checklistNum}/item/${itemNum}/assignee`, body);
        return data;
    } catch (error) {
        return {error};
    }
}

export async function setChecklistItemState(incidentID: string, checklistNum: number, itemNum: number, newState: ChecklistItemState) {
    const {data} = await doPut(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/item/${itemNum}/state`,
        JSON.stringify({
            new_state: newState,
        }),
    );

    return data;
}

export async function clientAddChecklistItem(incidentID: string, checklistNum: number, checklistItem: ChecklistItem) {
    const {data} = await doPut(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/add`,
        JSON.stringify(checklistItem),
    );

    return data;
}

export async function clientRemoveChecklistItem(incidentID: string, checklistNum: number, itemNum: number) {
    const {data} = await doFetchWithResponse(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/item/${itemNum}`, {
        method: 'delete',
        body: '',
    });

    return data;
}

export async function clientEditChecklistItem(incidentID: string, checklistNum: number, itemNum: number, newItem: ChecklistItem) {
    const {data} = await doPut(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/item/${itemNum}`,
        JSON.stringify({
            title: newItem.title,
            command: newItem.command,
        }));

    return data;
}

export async function clientReorderChecklist(incidentID: string, checklistNum: number, itemNum: number, newLocation: number) {
    const {data} = await doPut(`${apiUrl}/incidents/${incidentID}/checklists/${checklistNum}/reorder`,
        JSON.stringify({
            item_num: itemNum,
            new_location: newLocation,
        }),
    );

    return data;
}

export async function setActiveStage(incidentId: string, activeStage: number) {
    const data = await doPatch(`${apiUrl}/incidents/${incidentId}`, JSON.stringify({
        active_stage: activeStage,
    }));

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
        method: 'POST',
        body,
    });

    return data;
};

export const doPut = async (url: string, body = {}) => {
    const {data} = await doFetchWithResponse(url, {
        method: 'PUT',
        body,
    });

    return data;
};

export const doPatch = async (url: string, body = {}) => {
    const {data} = await doFetchWithResponse(url, {
        method: 'PATCH',
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
