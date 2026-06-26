// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    ApolloClient,
    ApolloProvider,
    HttpLink,
    InMemoryCache,
    NormalizedCacheObject,
} from '@apollo/client';

import {Client4} from 'mattermost-redux/client';
import {relayStylePagination} from '@apollo/client/utilities';

import {getApiUrl} from 'src/client';

interface ApolloWrapperProps {
    component: React.ReactNode
    client: ApolloClient<NormalizedCacheObject>
}

export const ApolloWrapper = (props: ApolloWrapperProps) => {
    return (
        <ApolloProvider client={props.client}>
            {props.component}
        </ApolloProvider>
    );
};

// Lowercase header names so case-variant duplicates collapse into one. Header names are
// case-insensitive, so this is wire-equivalent.
function dedupeHeaders(headers: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
}

export function buildQueryFetchOptions(options: any) {
    const result = Client4.getOptions(options);
    return {...result, headers: dedupeHeaders(result.headers)};
}

export function makeGraphqlClient(isDevelopment: boolean) {
    const graphqlFetch = (_: RequestInfo, options: any) => {
        return fetch(`${getApiUrl()}/query`, buildQueryFetchOptions(options));
    };
    const graphqlClient = new ApolloClient({
        link: new HttpLink({fetch: graphqlFetch}),
        connectToDevTools: isDevelopment,
        cache: new InMemoryCache({
            typePolicies: {
                Query: {
                    fields: {
                        runs: relayStylePagination(['teamID', 'sort', 'direction', 'statuses', 'participantOrFollowerID', 'channelID']),
                    },
                },
            },
        }),
    });
    return graphqlClient;
}

