// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Description from 'src/components/backstage/incidents/incident_backstage/overview/description';
import Metrics from 'src/components/backstage/incidents/incident_backstage/overview/metrics';
import RetrospectiveSummary
    from 'src/components/backstage/incidents/incident_backstage/overview/retrospective_summary';
import {Incident} from 'src/types/incident';
import Updates from 'src/components/backstage/incidents/incident_backstage/overview/updates';
import About from 'src/components/backstage/incidents/incident_backstage/overview/about';
import Participants from 'src/components/backstage/incidents/incident_backstage/overview/participants';
import {Container, Left, Right} from 'src/components/backstage/incidents/shared';

export const Overview = (props: {incident: Incident}) => {
    return (
        <Container>
            <Left>
                <Description incident={props.incident}/>
                <Metrics/>
                <RetrospectiveSummary/>
                <Updates incident={props.incident}/>
            </Left>
            <Right>
                <Participants incident={props.incident}/>
            </Right>
        </Container>
    );
};
