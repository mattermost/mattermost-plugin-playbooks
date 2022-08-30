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
import {useFavoriteRun, useRun, useRunMetadata} from 'src/hooks';

import {useLeaveRun} from './playbook_runs/playbook_run/context_menu';
import {useFollowers} from './playbook_runs/playbook_run/playbook_run';
import {CopyRunLinkMenuItem, FavoriteRunMenuItem, FollowRunMenuItem, LeaveRunMenuItem} from './playbook_runs/playbook_run/controls';
import {DotMenuButtonStyled} from './shared';

interface Props {
    playbookRunId: string;
    teamId: string
}

export const LHSRunDotMenu = ({playbookRunId, teamId}: Props) => {
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();
    const [isFavoriteRun, toggleFavorite] = useFavoriteRun(teamId, playbookRunId);
    const [playbookRun] = useRun(playbookRunId);
    const currentUser = useSelector(getCurrentUser);
    const [metadata] = useRunMetadata(playbookRun?.id, [JSON.stringify(playbookRun?.participant_ids)]);
    const followState = useFollowers(metadata?.followers || []);
    const {isFollowing, followers, setFollowers} = followState;
    const {leaveRunConfirmModal, showLeaveRunConfirm} = useLeaveRun(playbookRunId, isFollowing);

    const role = playbookRun?.participant_ids.includes(currentUser.id) ? Role.Participant : Role.Viewer;

    const toggleFollow = () => {
        const action = isFollowing ? unfollowPlaybookRun : followPlaybookRun;
        action(playbookRunId)
            .then(() => {
                const newFollowers = isFollowing ? followers.filter((userId) => userId !== currentUser.id) : [...followers, currentUser.id];
                setFollowers(newFollowers);
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
                        size={14}
                        color={'var(--button-color)'}
                    />
                )}
                dotMenuButton={DotMenuButtonStyled}
            >
                <FavoriteRunMenuItem
                    isFavoriteRun={isFavoriteRun}
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
