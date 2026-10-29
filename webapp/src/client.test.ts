// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {doFetchWithoutResponse, doPost} from './client';

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
        return Object.entries(headers).
            filter(([name]) => name.toLowerCase() === 'content-type').
            map(([, value]) => value);
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
