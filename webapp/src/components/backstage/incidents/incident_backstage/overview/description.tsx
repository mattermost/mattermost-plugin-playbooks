// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {
    Content,
    TabPageContainer,
    Title,
} from 'src/components/backstage/incidents/incident_backstage/shared';

const Heading = styled.div`
    margin: 10px 0 0 0;
    font-weight: 600;
`;

const Body = styled.p`
    margin: 8px;
`;

const Description = () => {
    return (
        <TabPageContainer>
            <Title>{'Description'}</Title>
            <Content>
                <Heading>{'# Summary'}</Heading>
                <Body>{'Three of the servers went down. At the moment we\'re not sure why. We think it might have something to do with Route 53. We are on the phone with our AWS Technical Account Manager.'}</Body>
                <Heading>{'# Impact'}</Heading>
                <Body>{'10 customers are are experiencing P50 response times above our SLA.'}</Body>
            </Content>
        </TabPageContainer>
    );
};

export default Description;
