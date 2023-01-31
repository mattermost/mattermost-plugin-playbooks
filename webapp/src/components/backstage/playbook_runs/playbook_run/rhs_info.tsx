// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {Channel} from '@mattermost/types/channels';

import RHSInfoOverview from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_overview';
import RHSInfoMetrics from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_metrics';
import RHSInfoActivity from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_activity';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {FragmentType, getFragmentData, graphql} from 'src/graphql/generated';
import {RunStatus} from 'src/graphql/generated/graphql';

const RHSInfoRun = graphql(/* GraphQL */`
    fragment RHSInfo on Run {
        id
        retrospectiveEnabled
        currentStatus
        ...RHSInfoOverview
        ...RHSInfoMetricsRun
        ...RHSInfoActivity
    }
`);

interface Props {
    run: FragmentType<typeof RHSInfoRun>
    playbook?: PlaybookWithChecklist;
    role: Role;
    channel: Channel | undefined | null;
    followState: FollowState;
    onViewParticipants: () => void;
    onViewTimeline: () => void;
}

export interface FollowState {
    isFollowing: boolean;
    followers: string[];
    setFollowers: (followers: string[]) => void;
}

const RHSInfo = (props: Props) => {
    const run = getFragmentData(RHSInfoRun, props.run);
    const isParticipant = props.role === Role.Participant;
    const isFinished = run.currentStatus === RunStatus.Finished;
    const editable = isParticipant && !isFinished;

    return (
        <Container>
            <RHSInfoOverview
                role={props.role}
                runFragment={run}
                onViewParticipants={props.onViewParticipants}
                editable={editable}
                channel={props.channel}
                followState={props.followState}
                playbook={props.playbook}
            />
            {run.retrospectiveEnabled ? (
                <RHSInfoMetrics
                    run={run}
                    playbook={props.playbook}
                    editable={editable}
                />
            ) : null}
            <RHSInfoActivity
                runFragment={run}
                role={props.role}
                onViewTimeline={props.onViewTimeline}
            />
        </Container>
    );
};

export default RHSInfo;

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;
