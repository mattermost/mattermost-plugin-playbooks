// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {ClientError} from 'mattermost-redux/client/client4';

import pluginId from './manifest';

const apiUrl = `/plugins/${pluginId}/api/v1`;

export function fetchIncidents() {
    return doGet(`${apiUrl}/incidents`);
}

export function fetchIncidentDetails(id: string) {
    return doGet(`${apiUrl}/incidents/${id}`);
}

export const doGet = async (url: string) => {
    const {data} = await doFetchWithResponse(url, {method: 'get'});

    return data;
};

export const doPost = async (url: string, body: string) => {
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
