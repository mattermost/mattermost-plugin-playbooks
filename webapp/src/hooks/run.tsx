// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import styled from 'styled-components';
import {useUpdateEffect} from 'react-use';

import {SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {
    followPlaybookRun,
    unfollowPlaybookRun,
    isFavoriteItem,
    telemetryEvent,
} from 'src/client';
import {useRunMembership, useUpdateRun} from 'src/graphql/hooks';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {PlaybookRunEventTarget} from 'src/types/telemetry';
import {ToastType, useToaster} from 'src/components/backstage/toast_banner';
import {CategoryItemType} from 'src/types/category';
import Tooltip from 'src/components/widgets/tooltip';
import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';

export const useFavoriteRun = (teamID: string, runID: string): [boolean, () => void] => {
    const [isFavoriteRun, setIsFavoriteRun] = useState(false);
    const updateRun = useUpdateRun(runID);

    useEffect(() => {
        isFavoriteItem(teamID, runID, CategoryItemType.RunItemType)
            .then(setIsFavoriteRun)
            .catch(() => setIsFavoriteRun(false));
    }, [teamID, runID]);

    const toggleFavorite = () => {
        if (isFavoriteRun) {
            updateRun({isFavorite: false});
            setIsFavoriteRun(false);
            return;
        }
        updateRun({isFavorite: true});
        setIsFavoriteRun(true);
    };
    return [isFavoriteRun, toggleFavorite];
};

export const useParticipateInRun = (playbookRunId: string, trigger: 'channel_rhs'|'run_details') => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const {addToRun} = useRunMembership(playbookRunId, [currentUserId]);
    const addToast = useToaster().add;
    const [showParticipateConfirm, setShowParticipateConfirm] = useState(false);
    const onConfirmParticipate = async () => {
        addToRun()
            .then(() => addToast(formatMessage({defaultMessage: 'You\'ve joined this run.'}), ToastType.Success))
            .catch(() => addToast(formatMessage({defaultMessage: 'It wasn\'t possible to join the run'}), ToastType.Failure));
        telemetryEvent(PlaybookRunEventTarget.Participate, {playbookrun_id: playbookRunId});
    };
    const ParticipateConfirmModal = (
        <ConfirmModal
            show={showParticipateConfirm}
            title={formatMessage({defaultMessage: 'Participate in the run'})}
            message={formatMessage({defaultMessage: 'Become a participant of the run. As a participant, you can post status updates, assign and complete tasks, and perform retrospectives.'})}
            confirmButtonText={formatMessage({defaultMessage: 'Confirm'})}
            onConfirm={() => {
                onConfirmParticipate();
                setShowParticipateConfirm(false);
            }}
            onCancel={() => setShowParticipateConfirm(false)}
        />
    );
    return {
        ParticipateConfirmModal,
        showParticipateConfirm: () => {
            setShowParticipateConfirm(true);
            telemetryEvent(PlaybookRunEventTarget.RequestUpdateClick, {
                playbookrun_id: playbookRunId,
                from: trigger,
            });
        },
    };
};

interface FollowState {
    isFollowing: boolean;
    followers: string[];
    setFollowers: (followers: string[]) => void;
}

export const useFollowRun = (runID: string, followState: FollowState | undefined, trigger: 'run_details'|'lhs'|'channel_rhs') => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const currentUserId = useSelector(getCurrentUserId);
    const refreshLHS = useLHSRefresh();

    if (followState === undefined) {
        return null;
    }
    const {isFollowing, followers, setFollowers} = followState;

    const FollowButton = styled(TertiaryButton)`
        font-size: 12px;
        height: 24px;
        padding: 0 10px;
    `;

    const UnfollowButton = styled(SecondaryButton)`
        font-size: 12px;
        height: 24px;
        padding: 0 10px;
    `;

    const toggleFollow = () => {
        const action = isFollowing ? unfollowPlaybookRun : followPlaybookRun;
        const eventTarget = isFollowing ? PlaybookRunEventTarget.Unfollow : PlaybookRunEventTarget.Follow;
        action(runID)
            .then(() => {
                const newFollowers = isFollowing ? followers.filter((userId: string) => userId !== currentUserId) : [...followers, currentUserId];
                setFollowers(newFollowers);
                refreshLHS();
                telemetryEvent(eventTarget, {
                    playbookrun_id: runID,
                    from: trigger,
                });
            })
            .catch(() => {
                addToast(formatMessage({defaultMessage: 'It was not possible to {isFollowing, select, true {unfollow} other {follow}} the run'}, {isFollowing}), ToastType.Failure);
            });
    };

    const FollowingButton = () => {
        if (isFollowing) {
            return (
                <UnfollowButton
                    className={'unfollowButton'}
                    onClick={toggleFollow}
                >
                    {formatMessage({defaultMessage: 'Following'})}
                </UnfollowButton>
            );
        }

        return (
            <Tooltip
                id={'follow-tooltip'}
                placement='bottom'
                content={formatMessage({defaultMessage: 'Get run status update notifications'})}
            >
                <FollowButton
                    className={'followButton'}
                    onClick={toggleFollow}
                >
                    {formatMessage({defaultMessage: 'Follow'})}
                </FollowButton>
            </Tooltip>
        );
    };

    return FollowingButton;
};

export const useRunFollowers = (metadataFollowers: string[]) => {
    const currentUserId = useSelector(getCurrentUserId);
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
