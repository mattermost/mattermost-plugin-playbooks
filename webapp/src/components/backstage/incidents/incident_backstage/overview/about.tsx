// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {Incident} from 'src/types/incident';
import {Content, TabPageContainer, Title} from 'src/components/backstage/incidents/shared';
import Profile from 'src/components/profile/profile';
import Duration from 'src/components/duration';

const StyledContent = styled(Content)`
    padding: 24px;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
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

const SmallProfile = styled(Profile)`
    > .image {
        width: 24px;
        height: 24px;
    }
`;

const About = (props: { incident: Incident }) => {
    return (
        <TabPageContainer>
            <Title>{'About'}</Title>
            <StyledContent>
                <Grid>
                    <ColTitle>{'Commander'}</ColTitle>
                    <ColTitle>{'Duration'}</ColTitle>
                    <ColItem>
                        <SmallProfile userId={props.incident.commander_user_id}/>
                    </ColItem>
                    <ColItem>
                        <Duration
                            from={props.incident.create_at}
                            to={props.incident.end_at}
                        />
                    </ColItem>
                </Grid>
            </StyledContent>
        </TabPageContainer>
    );
};

export default About;
