// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {StarIcon, StarOutlineIcon, LinkVariantIcon, CloseIcon, DotsVerticalIcon, BullhornOutlineIcon} from '@mattermost/compass-icons/components';
import {useSelector} from 'react-redux';
import {getCurrentUser} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/users';

import {followPlaybookRun, getSiteUrl, unfollowPlaybookRun} from 'src/client';
import DotMenu, {DotMenuButton} from 'src/components/dot_menu';
import {copyToClipboard} from 'src/utils';
import {ToastType, useToaster} from 'src/components/backstage/toast_banner';
import {Role, Separator} from 'src/components/backstage/playbook_runs/shared';
import {useFavoriteRun, useRun, useRunMetadata} from 'src/hooks';

import {StyledDropdownMenuItem, StyledDropdownMenuItemRed, useLeaveRun} from './playbook_runs/playbook_run/context_menu';
import {useFollowers} from './playbook_runs/playbook_run/playbook_run';

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
                title={formatMessage({defaultMessage: 'Run options'})}
                placement='bottom-start'
                icon={(
                    <DotsVerticalIcon
                        size={14}
                        color={'var(--button-color)'}
                    />
                )}
                dotMenuButton={DotMenuButtonStyled}
            >
                <StyledDropdownMenuItem onClick={toggleFavorite}>
                    {isFavoriteRun ? (
                        <><StarOutlineIcon size={18}/>{formatMessage({defaultMessage: 'Unfavorite'})}</>
                    ) : (
                        <><StarIcon size={18}/>{formatMessage({defaultMessage: 'Favorite'})}</>
                    )}
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem
                    onClick={() => {
                        copyToClipboard(getSiteUrl() + '/playbooks/runs/' + playbookRunId);
                        addToast(formatMessage({defaultMessage: 'Copied!'}));
                    }}
                >
                    <LinkVariantIcon size={18}/>
                    <FormattedMessage defaultMessage='Copy link'/>
                </StyledDropdownMenuItem>
                <Separator/>
                <StyledDropdownMenuItem
                    onClick={toggleFollow}
                >
                    <BullhornOutlineIcon size={18}/>
                    {isFollowing ? formatMessage({defaultMessage: 'Unfollow'}) : formatMessage({defaultMessage: 'Follow'})}
                </StyledDropdownMenuItem>
                {
                    role === Role.Participant &&
                    <>
                        <Separator/>
                        <StyledDropdownMenuItemRed onClick={showLeaveRunConfirm}>
                            <CloseIcon size={18}/>
                            <FormattedMessage
                                defaultMessage='Leave {isFollowing, select, true { and unfollow } other {}}run'
                                values={{isFollowing}}
                            />
                        </StyledDropdownMenuItemRed>
                    </>
                }
            </DotMenu>

            {leaveRunConfirmModal}
        </>
    );
};

const DotMenuButtonStyled = styled(DotMenuButton)`
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
`;

