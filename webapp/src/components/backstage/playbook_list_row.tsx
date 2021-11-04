// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {GlobalState} from 'mattermost-redux/types/store';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {FormattedMessage} from 'react-intl';

import {Playbook} from 'src/types/playbook';
import TextWithTooltip from '../widgets/text_with_tooltip';

import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import DotMenuIcon from 'src/components/assets/icons/dot_menu_icon';

import {InfoLine} from './styles';

interface Props {
    playbook: Playbook
    displayTeam: boolean
    onClick: () => void
    onEdit: () => void
    onDelete: () => void
}

const teamNameSelector = (teamId: string) => (state: GlobalState): string => getTeam(state, teamId).display_name;

const PlaybookListRow = (props: Props) => {
    const teamName = useSelector(teamNameSelector(props.playbook.team_id));
    return (
        <div
            className='row playbook-item'
            key={props.playbook.id}
            onClick={props.onClick}
        >
            <div className='col-sm-4 title'>
                <TextWithTooltip
                    id={props.playbook.title}
                    text={props.playbook.title}
                />
                {props.displayTeam && <InfoLine>{teamName}</InfoLine>}
            </div>
            <div className='col-sm-2'>{props.playbook.num_stages}</div>
            <div className='col-sm-2'>{props.playbook.num_steps}</div>
            <div className='col-sm-2'>{props.playbook.num_runs}</div>
            <div className='col-sm-2 action-col'>
                <PlaybookActionMenu
                    onEdit={props.onEdit}
                    onDelete={props.onDelete}
                />
            </div>
        </div>
    );
};

interface PlaybookActionMenuProps {
    onEdit: () => void;
    onDelete: () => void;
}

const IconWrapper = styled.div`
    display: inline-flex;
    padding: 10px 5px 10px 3px;
`;

const PlaybookActionMenu = (props: PlaybookActionMenuProps) => {
    return (
        <DotMenu
            icon={
                <IconWrapper>
                    <DotMenuIcon/>
                </IconWrapper>
            }
        >
            <DropdownMenuItem
                onClick={props.onEdit}
            >
                <FormattedMessage defaultMessage='Edit'/>
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={props.onDelete}
            >
                <FormattedMessage defaultMessage='Delete'/>
            </DropdownMenuItem>
        </DotMenu>
    );
};

export default PlaybookListRow;
