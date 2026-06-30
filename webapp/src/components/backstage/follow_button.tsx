// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {useAppSelector} from 'src/hooks/redux';

import {SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {followPlaybookRun, unfollowPlaybookRun} from 'src/client';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';

interface FollowState {
    isFollowing: boolean;
    followers: string[];
    setFollowers: (followers: string[]) => void;
}

interface Props {
    runID: string;
    followState?: FollowState;
}

export const FollowUnfollowButton = ({runID, followState}: Props) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const currentUserId = useAppSelector(getCurrentUserId);
    const refreshLHS = useLHSRefresh();

    if (followState === undefined) {
        return null;
    }
    const {isFollowing, followers, setFollowers} = followState;

    const toggleFollow = () => {
        const action = isFollowing ? unfollowPlaybookRun : followPlaybookRun;
        action(runID)
            .then(() => {
                const newFollowers = isFollowing ? followers.filter((userId: string) => userId !== currentUserId) : [...followers, currentUserId];
                setFollowers(newFollowers);
                refreshLHS();
            })
            .catch(() => {
                addToast({
                    content: formatMessage({defaultMessage: 'It was not possible to {isFollowing, select, true {unfollow} other {follow}} the run'}, {isFollowing}),
                    toastStyle: ToastStyle.Failure,
                });
            });
    };

    if (isFollowing) {
        return (
            <SecondaryButton
                size='xs'
                onClick={toggleFollow}
            >
                {formatMessage({defaultMessage: 'Following'})}
            </SecondaryButton>
        );
    }

    return (
        <WithTooltip
            id={'follow-tooltip'}

            title={formatMessage({defaultMessage: 'Get run status update notifications'})}
        >
            <TertiaryButton
                size='xs'
                onClick={toggleFollow}
            >
                {formatMessage({defaultMessage: 'Follow'})}
            </TertiaryButton>
        </WithTooltip>
    );
};

export default FollowUnfollowButton;
