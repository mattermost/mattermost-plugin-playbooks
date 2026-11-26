// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    RunUpdateFields,
    doFetchWithoutResponse,
    doPost,
    getApiUrl,
    updatePlaybookRun,
} from './client';

describe('REST fetch options (MM-69322)', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            headers: {get: () => 'application/json'},
            json: async () => ({}),
        });
        global.fetch = fetchMock;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    const contentTypeValues = () => {
        const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
        return Object.entries(headers)
            .filter(([name]) => name.toLowerCase() === 'content-type')
            .map(([, value]) => value);
    };

    it('sends a single Content-Type header on POST', async () => {
        await doPost('/plugins/playbooks/api/v0/runs/run_id/participants', JSON.stringify({user_ids: ['u1']}));

        expect(contentTypeValues()).toEqual(['application/json']);
    });

    it('sends a single Content-Type header on PATCH', async () => {
        await doFetchWithoutResponse('/plugins/playbooks/api/v0/runs/run_id', {
            method: 'PATCH',
            body: JSON.stringify({name: 'n'}),
        });

        expect(contentTypeValues()).toEqual(['application/json']);
    });
});

describe('updatePlaybookRun', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            headers: {get: () => 'application/json'},
            json: async () => ({id: 'run-1'}),
        });
        global.fetch = fetchMock;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('sends the PlaybookRunUpdateOptions keys, omits undefined, and passes null through', async () => {
        const allFields: Required<RunUpdateFields> = {
            name: 'Incident',
            summary: null,
            channelID: 'channel-1',
            createChannelMemberOnNewParticipant: true,
            removeChannelMemberOnRemovedParticipant: false,
            statusUpdateBroadcastChannelsEnabled: null,
            statusUpdateBroadcastWebhooksEnabled: true,
            broadcastChannelIDs: ['chan-a'],
            webhookOnStatusUpdateURLs: null,
        };

        await updatePlaybookRun('run-1', allFields);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`${getApiUrl()}/runs/run-1`);
        expect(options.method).toBe('PATCH');
        expect(JSON.parse(options.body)).toEqual({
            name: 'Incident',
            summary: null,
            channel_id: 'channel-1',
            create_channel_member_on_new_participant: true,
            remove_channel_member_on_removed_participant: false,
            status_update_broadcast_channels_enabled: null,
            status_update_broadcast_webhooks_enabled: true,
            broadcast_channel_ids: ['chan-a'],
            webhook_on_status_update_urls: null,
        });

        fetchMock.mockClear();
        await updatePlaybookRun('run-1', {name: 'Only name'});

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({name: 'Only name'});
    });
});
