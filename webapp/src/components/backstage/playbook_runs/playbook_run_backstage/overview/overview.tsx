// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {usePlaybookRunViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookRunViewTarget} from 'src/types/telemetry';
import Description from 'src/components/backstage/playbook_runs/playbook_run_backstage/overview/description';
import Updates from 'src/components/backstage/playbook_runs/playbook_run_backstage/overview/updates';
import Participants from 'src/components/backstage/playbook_runs/playbook_run_backstage/overview/participants';

import About from 'src/components/backstage/playbook_runs/playbook_run_backstage/overview/about';

import {Container, Left, Right} from 'src/components/backstage/playbook_runs/shared';
import {PlaybookRun} from 'src/types/playbook_run';

export const Overview = (props: {playbookRun: PlaybookRun}) => {
    usePlaybookRunViewTelemetry(PlaybookRunViewTarget.Overview, props.playbookRun.id);

    return (
        <Container>
            <Left>
                <Description playbookRun={props.playbookRun}/>
                <Updates playbookRun={props.playbookRun}/>
            </Left>
            <Right>
                <About playbookRun={props.playbookRun}/>
                <Participants playbookRun={props.playbookRun}/>
            </Right>
        </Container>
    );
};
