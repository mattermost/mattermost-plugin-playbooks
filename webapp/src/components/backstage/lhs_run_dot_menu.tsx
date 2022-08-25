// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {StarIcon, StarOutlineIcon, LinkVariantIcon, CloseIcon, DotsVerticalIcon, BullhornOutlineIcon} from '@mattermost/compass-icons/components';

import {getSiteUrl} from 'src/client';
import {PlaybookRun} from 'src/types/playbook_run';
import DotMenu, {DotMenuButton} from 'src/components/dot_menu';
import {copyToClipboard} from 'src/utils';
import {useToaster} from 'src/components/backstage/toast_banner';
import {Role, Separator} from 'src/components/backstage/playbook_runs/shared';

import {StyledDropdownMenuItem, StyledDropdownMenuItemRed, useLeaveRun} from './playbook_runs/playbook_run/context_menu';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
    isFavoriteRun: boolean;
    isFollowing: boolean;
    toggleFavorite: () => void;
    toggleFollow: () => void;
}

export const LHSRunDotMenu = ({playbookRun, role, isFavoriteRun, isFollowing, toggleFavorite, toggleFollow}: Props) => {
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();
    const {leaveRunConfirmModal, showLeaveRunConfirm} = useLeaveRun(playbookRun, isFollowing);

    return (
        <>
            <DotMenu
                title={formatMessage({defaultMessage: 'Run options'})}
                placement='bottom-end'
                icon={(
                    <DotsVerticalIcon
                        size={16}
                        color={'currentColor'}
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
                        copyToClipboard(getSiteUrl() + '/playbooks/runs/' + playbookRun?.id);
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

