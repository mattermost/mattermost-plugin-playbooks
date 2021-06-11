// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

//import Followups from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/followups';
//import Learnings from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/learnings';

import Report from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/report';
import TimelineRetro from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/timeline_retro';

import {PlaybookRun} from 'src/types/playbook_run';
import {Container, Left, Right} from 'src/components/backstage/playbook_runs/shared';

export const Retrospective = (props: { playbookRun: PlaybookRun }) => {
    return (
        <Container>
            <Left>
                <Report playbookRun={props.playbookRun}/>
                {/*<Learnings playbookRun={props.playbookRun}/>*/}
                {/*<Followups playbookRun={props.playbookRun}/>*/}
            </Left>
            <Right>
                <TimelineRetro playbookRun={props.playbookRun}/>
            </Right>
        </Container>
    );
};
