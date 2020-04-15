// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {GetStateFunc} from 'mattermost-redux/types/actions';
import {AnyAction, Dispatch} from 'redux';
import qs from 'qs';

import {Client4} from 'mattermost-redux/client';
import {ClientError} from 'mattermost-redux/client/client4';

import {setTriggerId} from 'src/actions';
import {Playbook} from 'src/types/incident';

import {pluginId} from './manifest';

const apiUrl = `/plugins/${pluginId}/api/v1`;

export function fetchIncidents(teamId?: string) {
    const queryParams = qs.stringify({
        team_id: teamId,
    }, {addQueryPrefix: true});

    return doGet(`${apiUrl}/incidents${queryParams}`);
}

export function fetchIncidentDetails(id: string) {
    return doGet(`${apiUrl}/incidents/${id}`);
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

export function fetchPlaybooks() {
    return doGet(`${apiUrl}/playbooks/`);
}

export async function createPlaybook(playbook: Playbook) {
    const {data} = await doPost(`${apiUrl}/playbooks`, playbook);

    return data;
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
