// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {StarIcon, StarOutlineIcon, LinkVariantIcon, CloseIcon, DotsVerticalIcon} from '@mattermost/compass-icons/components';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/users';

import {getSiteUrl} from 'src/client';
import DotMenu from 'src/components/dot_menu';
import {copyToClipboard} from 'src/utils';
import {useToaster} from 'src/components/backstage/toast_banner';
import {Separator} from 'src/components/backstage/playbook_runs/shared';
import {usePlaybookMembership, useUpdatePlaybook} from 'src/graphql/hooks';

import {useLHSRefresh} from './lhs_navigation';
import {DotMenuButtonStyled, StyledDropdownMenuItem} from './shared';

interface Props {
    playbookId: string;
    isFavorite: boolean;
}

export const LHSPlaybookDotMenu = ({playbookId, isFavorite}: Props) => {
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();
    const currentUserId = useSelector(getCurrentUserId);
    const refreshLHS = useLHSRefresh();
    const updatePlaybook = useUpdatePlaybook(playbookId);

    const {leave} = usePlaybookMembership(playbookId, currentUserId);
    const toggleFavorite = async () => {
        await updatePlaybook({isFavorite: !isFavorite});
        refreshLHS();
    };
    return (
        <>
            <DotMenu
                title={formatMessage({defaultMessage: 'Playbook options'})}
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
                    {isFavorite ? (
                        <><StarOutlineIcon size={18}/>{formatMessage({defaultMessage: 'Unfavorite'})}</>
                    ) : (
                        <><StarIcon size={18}/>{formatMessage({defaultMessage: 'Favorite'})}</>
                    )}
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem
                    onClick={() => {
                        copyToClipboard(getSiteUrl() + '/playbooks/playbooks/' + playbookId);
                        addToast(formatMessage({defaultMessage: 'Copied!'}));
                    }}
                >
                    <LinkVariantIcon size={18}/>
                    <FormattedMessage defaultMessage='Copy link'/>
                </StyledDropdownMenuItem>
                <Separator/>
                <StyledDropdownMenuItem
                    onClick={async () => {
                        await leave();
                        refreshLHS();
                    }}
                >
                    <CloseIcon
                        size={18}
                        color='currentColor'
                    />
                    <FormattedMessage defaultMessage='Leave'/>
                </StyledDropdownMenuItem>
            </DotMenu>
        </>
    );
};