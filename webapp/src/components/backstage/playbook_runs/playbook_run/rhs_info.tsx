// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import {useUpdateEffect} from 'react-use';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {usePlaybook, useRun, useRunMetadata, useChannel} from 'src/hooks';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import RHSInfoOverview from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_overview';
import RHSInfoMetrics from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_metrics';
import RHSInfoActivity from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_activity';
import {PlaybookRunStatus} from 'src/types/playbook_run';
import {openBackstageRHS} from 'src/actions';
import {currentBackstageRHS} from 'src/selectors';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';

export const RunInfoTitle = <FormattedMessage defaultMessage={'Run info'}/>;

// Initially duplicated
const useFollowers = (metadataFollowers: string[], currentUserId: string) => {
    const [followers, setFollowers] = useState(metadataFollowers);
    const [isFollowing, setIsFollowing] = useState(followers.includes(currentUserId));

    useUpdateEffect(() => {
        setFollowers(metadataFollowers);
    }, [currentUserId, JSON.stringify(metadataFollowers)]);

    useUpdateEffect(() => {
        setIsFollowing(followers.includes(currentUserId));
    }, [currentUserId, JSON.stringify(followers)]);

    return {isFollowing, followers, setFollowers};
};
export interface FollowState {
    isFollowing: boolean;
    followers: string[];
    setFollowers: (followers: string[]) => void;
}

const RHSInfo = () => {
    const dispatch = useDispatch();
    const RHS = useSelector(currentBackstageRHS);

    const playbookRunId = RHS.resourceId;
    const [run] = useRun(playbookRunId);
    const [playbook] = usePlaybook(run?.playbook_id);
    const [channel] = useChannel(run?.channel_id ?? '');
    const myUserId = useSelector(getCurrentUserId);

    // we must force metadata refetch when participants change (leave&unfollow)
    const [metadata] = useRunMetadata(playbookRunId, [JSON.stringify(run?.participant_ids)]);
    const followState = useFollowers(metadata?.followers || [], myUserId);

    if (!run || !metadata) {
        return null;
    }

    const role = run.participant_ids.includes(myUserId) ? Role.Participant : Role.Viewer;
    const isParticipant = role === Role.Participant;
    const isFinished = run.current_status === PlaybookRunStatus.Finished;
    const editable = isParticipant && !isFinished;

    return (
        <Container>
            <RHSInfoOverview
                run={run}
                runMetadata={metadata}
                onViewParticipants={() => dispatch(openBackstageRHS(BackstageRHSSection.RunParticipants, BackstageRHSViewMode.Overlap, run.id))}
                editable={editable}
                channel={channel}
                followState={followState}
            />
            {run.retrospective_enabled ? (
                <RHSInfoMetrics
                    runID={run.id}
                    metricsData={run.metrics_data}
                    metricsConfig={playbook?.metrics}
                    editable={editable}
                />
            ) : null}
            <RHSInfoActivity
                run={run}
                role={role}
                onViewTimeline={() => dispatch(openBackstageRHS(BackstageRHSSection.RunTimeline, BackstageRHSViewMode.Overlap, run.id))}
            />
        </Container>
    );
};

export default RHSInfo;

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;
