// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BullhornOutlineIcon, CloseIcon, LinkVariantIcon, StarIcon, StarOutlineIcon} from '@mattermost/compass-icons/components';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {getSiteUrl} from 'src/client';
import {copyToClipboard} from 'src/utils';
import {StyledDropdownMenuItem, StyledDropdownMenuItemRed} from '../../shared';
import {useToaster} from '../../toast_banner';
import {Role, Separator} from '../shared';

export const FavoriteRunMenuItem = (props: {isFavoriteRun: boolean, toggleFavorite: () => void}) => {
    return (
        <StyledDropdownMenuItem onClick={props.toggleFavorite}>
            {props.isFavoriteRun ? (
                <>
                    <StarOutlineIcon size={18}/>
                    <FormattedMessage defaultMessage='Unfavorite'/>
                </>
            ) : (
                <>
                    <StarIcon size={18}/>
                    <FormattedMessage defaultMessage='Favorite'/>
                </>
            )}
        </StyledDropdownMenuItem>
    );
};

export const CopyRunLinkMenuItem = (props: {playbookRunId: string}) => {
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();

    return (
        <StyledDropdownMenuItem
            onClick={() => {
                copyToClipboard(getSiteUrl() + '/playbooks/runs/' + props.playbookRunId);
                addToast(formatMessage({defaultMessage: 'Copied!'}));
            }}
        >
            <LinkVariantIcon size={18}/>
            <FormattedMessage defaultMessage='Copy link'/>
        </StyledDropdownMenuItem>
    );
};

export const FollowRunMenuItem = (props: {isFollowing: boolean, toggleFollow: () => void}) => {
    return (
        <StyledDropdownMenuItem
            onClick={props.toggleFollow}
        >
            <BullhornOutlineIcon size={18}/>
            {props.isFollowing ? <FormattedMessage defaultMessage='Unfollow'/> : <FormattedMessage defaultMessage='Follow'/>}
        </StyledDropdownMenuItem>
    );
};

export const LeaveRunMenuItem = (props: {isFollowing: boolean, role: Role, showLeaveRunConfirm: () => void}) => {
    const isFollowing = props.isFollowing;

    if (props.role === Role.Participant) {
        return (
            <>
                <Separator/>
                <StyledDropdownMenuItemRed onClick={props.showLeaveRunConfirm}>
                    <CloseIcon size={18}/>
                    <FormattedMessage
                        defaultMessage='Leave {isFollowing, select, true { and unfollow } other {}}run'
                        values={{isFollowing}}
                    />
                </StyledDropdownMenuItemRed>
            </>
        );
    }

    return null;
};
