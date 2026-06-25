// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import {buildQueryFetchOptions} from './apollo';

describe('graphql fetch options (MM-69322)', () => {
    // Mimics the options Apollo's HttpLink passes to our fetch wrapper: a POST with a
    // body and a lowercase `content-type` header.
    const apolloOptions = () => ({
        method: 'POST',
        body: JSON.stringify({query: '{ runs { edges { node { id } } } }'}),
        headers: {accept: '*/*', 'content-type': 'application/json'},
    });

    const contentTypeKeys = (headers: Record<string, string>) =>
        Object.keys(headers).filter((k) => k.toLowerCase() === 'content-type');

    it('documents the upstream bug: Client4.getOptions alone duplicates the content-type header', () => {
        const raw = Client4.getOptions(apolloOptions());

        // Both a capitalized `Content-Type` (set by Client4) and Apollo's lowercase
        // `content-type` survive Object.assign, which fetch() later joins with ", ".
        expect(contentTypeKeys(raw.headers).length).toBeGreaterThan(1);
    });

    it('buildQueryFetchOptions yields exactly one content-type header', () => {
        const result = buildQueryFetchOptions(apolloOptions());

        expect(contentTypeKeys(result.headers)).toHaveLength(1);
    });

    it('collapses any case-insensitively duplicated header, not just content-type', () => {
        // The real defect is the case-sensitive merge, so the dedup must be general.
        // X-Requested-With is set canonically by Client4; a lowercase variant must not
        // produce a second key.
        const result = buildQueryFetchOptions({
            ...apolloOptions(),
            headers: {'content-type': 'application/json', 'x-requested-with': 'fetch'},
        });

        const names = Object.keys(result.headers).map((k) => k.toLowerCase());
        const dupes = names.filter((k, i) => names.indexOf(k) !== i);
        expect(dupes).toEqual([]);
    });
});
