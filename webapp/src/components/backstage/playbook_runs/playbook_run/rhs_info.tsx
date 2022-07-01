// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import RHSInfoOverview from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_overview';
import RHSInfoMetrics from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_metrics';
import RHSInfoActivity from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_activity';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {PlaybookRun, Metadata} from 'src/types/playbook_run';

interface Props {
    run: PlaybookRun;
    runMetadata: Metadata | null;
    role: Role;
    onViewParticipants: () => void;
}

const RHSInfo = (props: Props) => {
    return (
        <Container>
            <RHSInfoOverview
                run={props.run}
                runMetadata={props.runMetadata}
                role={props.role}
                onViewParticipants={props.onViewParticipants}
            />
            <RHSInfoMetrics/>
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
