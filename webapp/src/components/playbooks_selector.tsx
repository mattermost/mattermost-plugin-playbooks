
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {ApolloProvider} from '@apollo/client';

import {usePlaybooksModalQuery} from 'src/graphql/generated_types';
import {getPlaybooksGraphQLClient} from 'src/graphql_client';

interface Props {
    teamID: string;
}

const PlaybooksSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const {data, error} = usePlaybooksModalQuery({
        variables: {
            teamID: props.teamID,
            searchTerm: '',
        },
        fetchPolicy: 'cache-and-network',
    });
    console.log(data, error);
    return <div/>;
};

const WrappedPlaybooksSelector = (props: Props) => {
    const client = getPlaybooksGraphQLClient();
    return <ApolloProvider client={client}><PlaybooksSelector teamID={props.teamID}/></ApolloProvider>;
};
export default WrappedPlaybooksSelector;
