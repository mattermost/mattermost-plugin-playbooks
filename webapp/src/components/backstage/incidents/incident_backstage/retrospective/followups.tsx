// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {Incident, IncidentStatus} from 'src/types/incident';
import Profile from 'src/components/profile/profile';
import {Badge, Content, TabPageContainer, Title} from 'src/components/backstage/incidents/shared';

const StyledContent = styled(Content)`
    margin: 8px 0 0 0;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: 3fr 1fr 1fr 1fr;
    grid-template-rows: 1fr;
`;

const ColTitle = styled.div`
    font-weight: 600;
`;

const Cell = styled.div`
    padding-top: 8px;
`;

const SmallProfile = styled(Profile)`
    > .image {
        width: 16px;
        height: 16px;
    }
`;

const Line = styled.div`
    height: 1px;
    background: grey;
`;

const Followups = (props: { incident: Incident }) => {
    return (
        <TabPageContainer>
            <Title>{'Follow ups'}</Title>
            <StyledContent>
                <Grid>
                    <ColTitle>{'Description'}</ColTitle>
                    <ColTitle>{'Owner'}</ColTitle>
                    <ColTitle>{'Status'}</ColTitle>
                    <ColTitle>{'Jira issue'}</ColTitle>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>

                    <Cell>{'Improve our TTR by automating our OgsGenie webhooks.'}</Cell>
                    <Cell>
                        <SmallProfile userId={props.incident.commander_user_id}/>
                    </Cell>
                    <Cell>
                        <Badge status={'Open' as IncidentStatus}/>
                    </Cell>
                    <Cell>
                        <a href={''}>{'MM-42843'}</a>
                    </Cell>

                    <Cell>{'Notify affected customers sooner by collecting related Pagerduty events and DMing commander automatically.'}</Cell>
                    <Cell>
                        <SmallProfile userId={props.incident.reporter_user_id}/>
                    </Cell>
                    <Cell>
                        <Badge status={'In Progress' as IncidentStatus}/>
                    </Cell>
                    <Cell>
                        <a href={''}>{'MM-42850'}</a>
                    </Cell>
                </Grid>
            </StyledContent>
        </TabPageContainer>
    );
};

export default Followups;
