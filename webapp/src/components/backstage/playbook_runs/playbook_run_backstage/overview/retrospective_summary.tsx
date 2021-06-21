// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {EmptyBody, TabPageContainer, Title} from 'src/components/backstage/playbook_runs/shared';

const RetrospectiveSummary = () => {
    return (
        <TabPageContainer>
            <Title>{'Retrospective'}</Title>
            <EmptyBody>
                {'The retrospective will show here when it is published.'}
            </EmptyBody>
        </TabPageContainer>
    );
};

export default RetrospectiveSummary;
