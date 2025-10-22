// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DotsVerticalIcon, CreationOutlineIcon} from '@mattermost/compass-icons/components';
import {useDispatch} from 'react-redux';
import {FormattedMessage} from 'react-intl';

import DotMenu from 'src/components/dot_menu';
import {Separator} from 'src/components/backstage/playbook_runs/shared';
import {displayPlaybookCreateWithAIModal} from 'src/actions';

import {DotMenuButtonStyled, StyledDropdownMenuItem} from './shared';
import {CopyPlaybookLinkMenuItem, FavoritePlaybookMenuItem, LeavePlaybookMenuItem} from './playbook_editor/controls';

interface Props {
    playbookId: string;
    isFavorite: boolean;
}

export const LHSPlaybookDotMenu = ({playbookId, isFavorite}: Props) => {
    const dispatch = useDispatch();

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
                <FavoritePlaybookMenuItem
                    playbookId={playbookId}
                    isFavorite={isFavorite}
                />
                <CopyPlaybookLinkMenuItem playbookId={playbookId}/>
                <Separator/>
                <StyledDropdownMenuItem
                    onClick={() => dispatch(displayPlaybookCreateWithAIModal({initialPlaybookId: playbookId}))}
                >
                    <CreationOutlineIcon size={18}/>
                    <FormattedMessage defaultMessage='Edit with AI'/>
                </StyledDropdownMenuItem>
                <Separator/>
                <LeavePlaybookMenuItem playbookId={playbookId}/>
            </DotMenu>
        </>
    );
};
