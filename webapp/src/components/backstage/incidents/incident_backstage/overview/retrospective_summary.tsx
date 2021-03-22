// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {
    TabPageContainer,
    Title,
} from 'src/components/backstage/incidents/incident_backstage/shared';

const Body = styled.p`
    margin-top: 8px;
`;

const RetrospectiveSummary = () => {
    return (
        <TabPageContainer>
            <Title>{'Retrospective'}</Title>
            <Body>
                {'The retrospective will show here when it is published.'}
            </Body>
        </TabPageContainer>
    );
};

export default RetrospectiveSummary;
