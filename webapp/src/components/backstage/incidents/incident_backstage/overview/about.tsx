// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {IncidentStatus} from 'src/types/incident';
import {Badge, Content, TabPageContainer, Title} from 'src/components/backstage/incidents/shared';

const StyledContent = styled(Content)`
    padding: 10px 20px;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: 1fr 3fr;
    grid-template-rows: 1fr;
    grid-gap: 8px;
`;

const ColTitle = styled.div`
    display: flex;
    align-items: center;
    font-weight: 600;
`;

const ColItem = styled.div`
    display: flex;
    align-items: center;
`;

const About = () => {
    return (
        <TabPageContainer>
            <Title>{'About'}</Title>
            <StyledContent>
                <Grid>
                    <ColTitle>{'Status:'}</ColTitle>
                    <ColItem><Badge status={IncidentStatus.Active}/></ColItem>
                    <ColTitle>{'Severity:'}</ColTitle>
                    <ColItem><Badge status={'SEV-3' as IncidentStatus}/></ColItem>
                    <ColTitle>{'Type:'}</ColTitle>
                    <ColItem>{'Cloud outage'}</ColItem>
                </Grid>
            </StyledContent>
        </TabPageContainer>
    );
};

export default About;
