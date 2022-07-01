// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import RHSInfoOverview from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_overview';
import RHSInfoMetrics from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_metrics';
import RHSInfoActivity from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_activity';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {PlaybookRun, PlaybookRunStatus, Metadata} from 'src/types/playbook_run';
import {PlaybookWithChecklist} from 'src/types/playbook';

interface Props {
    run: PlaybookRun;
    playbook?: PlaybookWithChecklist;
    runMetadata?: Metadata;
    role: Role;
}

const RHSInfo = (props: Props) => {
    const isParticipant = props.role === Role.Participant;
    const isFinished = props.run.current_status === PlaybookRunStatus.Finished;
    const editable = isParticipant && !isFinished;

    return (
        <Container>
            <RHSInfoOverview
                run={props.run}
                runMetadata={props.runMetadata}
                editable={editable}
            />
            <RHSInfoMetrics
                metricsData={props.run.metrics_data}
                metricsConfig={props.playbook?.metrics}
                editable={editable}
            />
            <RHSInfoActivity
                run={props.run}
                role={props.role}
            />
        </Container>
    );
};

export default RHSInfo;

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;
