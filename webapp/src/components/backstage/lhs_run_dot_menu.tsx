// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import {useSelector} from 'react-redux';
import {getCurrentUser} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/users';

import {followPlaybookRun, unfollowPlaybookRun} from 'src/client';
import DotMenu from 'src/components/dot_menu';
import {ToastType, useToaster} from 'src/components/backstage/toast_banner';
import {Role, Separator} from 'src/components/backstage/playbook_runs/shared';

import {useUpdateRun} from 'src/graphql/hooks';
import {useRunFollowers} from 'src/hooks';

import {useLeaveRun} from './playbook_runs/playbook_run/context_menu';
import {CopyRunLinkMenuItem, FavoriteRunMenuItem, FollowRunMenuItem, LeaveRunMenuItem} from './playbook_runs/playbook_run/controls';
import {DotMenuButtonStyled} from './shared';
import {useLHSRefresh} from './lhs_navigation';

interface Props {
    playbookRunId: string;
    isFavorite: boolean;
    ownerUserId: string;
    participantIDs: string[];
    followerIDs: string[];
    hasPermanentViewerAccess: boolean;
}

export const LHSRunDotMenu = ({playbookRunId, isFavorite, ownerUserId, participantIDs, followerIDs, hasPermanentViewerAccess}: Props) => {
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();
    const updateRun = useUpdateRun(playbookRunId);
    const currentUser = useSelector(getCurrentUser);
    const refreshLHS = useLHSRefresh();

    const followState = useRunFollowers(followerIDs);
    const {isFollowing, followers, setFollowers} = followState;

    const {leaveRunConfirmModal, showLeaveRunConfirm} = useLeaveRun(hasPermanentViewerAccess, playbookRunId, ownerUserId, isFollowing);
    const role = participantIDs.includes(currentUser.id) ? Role.Participant : Role.Viewer;

    const toggleFavorite = () => {
        updateRun({isFavorite: !isFavorite});
    };

    const toggleFollow = () => {
        const action = isFollowing ? unfollowPlaybookRun : followPlaybookRun;
        action(playbookRunId)
            .then(() => {
                const newFollowers = isFollowing ? followers.filter((userId) => userId !== currentUser.id) : [...followers, currentUser.id];
                setFollowers(newFollowers);
                refreshLHS();
            })
            .catch(() => {
                addToast(formatMessage({defaultMessage: 'It was not possible to {isFollowing, select, true {unfollow} other {follow}} the run'}, {isFollowing}), ToastType.Failure);
            });
    };

    return (
        <>
            <DotMenu
                placement='bottom-start'
                icon={(
                    <DotsVerticalIcon
                        size={14.4}
                        color={'var(--button-color)'}
                    />
                )}
                dotMenuButton={DotMenuButtonStyled}
            >
                <FavoriteRunMenuItem
                    isFavoriteRun={isFavorite}
                    toggleFavorite={toggleFavorite}
                />
                <CopyRunLinkMenuItem
                    playbookRunId={playbookRunId}
                />
                <Separator/>
                <FollowRunMenuItem
                    isFollowing={isFollowing}
                    toggleFollow={toggleFollow}
                />
                <LeaveRunMenuItem
                    isFollowing={isFollowing}
                    role={role}
                    showLeaveRunConfirm={showLeaveRunConfirm}
                />
            </DotMenu>

            {leaveRunConfirmModal}
        </>
    );
};
