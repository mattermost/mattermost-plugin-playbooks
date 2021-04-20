// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Report from 'src/components/backstage/incidents/incident_backstage/retrospective/report';
import {Incident} from 'src/types/incident';
import Learnings
    from 'src/components/backstage/incidents/incident_backstage/retrospective/learnings';
import Followups
    from 'src/components/backstage/incidents/incident_backstage/retrospective/followups';
import TimelineRetro
    from 'src/components/backstage/incidents/incident_backstage/retrospective/timeline_retro';
import {Container, Left, Right} from 'src/components/backstage/incidents/shared';

export const Retrospective = (props: { incident: Incident }) => {
    return (
        <Container>
            <Left>
                <Report/>
                <Learnings incident={props.incident}/>
                <Followups incident={props.incident}/>
            </Left>
            <Right>
                <TimelineRetro incident={props.incident}/>
            </Right>
        </Container>
    );
};
