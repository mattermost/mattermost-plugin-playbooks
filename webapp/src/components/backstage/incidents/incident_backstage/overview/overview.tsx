// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Description from 'src/components/backstage/incidents/incident_backstage/overview/description';
import {Incident} from 'src/types/incident';
import Updates from 'src/components/backstage/incidents/incident_backstage/overview/updates';
import Participants from 'src/components/backstage/incidents/incident_backstage/overview/participants';
import {Container, Left, Right} from 'src/components/backstage/incidents/shared';
import About from 'src/components/backstage/incidents/incident_backstage/overview/about';

export const Overview = (props: {incident: Incident}) => {
    return (
        <Container>
            <Left>
                <Description incident={props.incident}/>
                <Updates incident={props.incident}/>
            </Left>
            <Right>
                <About incident={props.incident}/>
                <Participants incident={props.incident}/>
            </Right>
        </Container>
    );
};
