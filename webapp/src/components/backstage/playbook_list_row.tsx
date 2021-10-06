// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {useSelector} from 'react-redux';

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

const ActionCol = styled.div`
    margin-left: -8px;
`;

const PlaybookItem = styled.div`
    cursor: pointer;
    display: flex;
    padding-top: 15px;
    padding-bottom: 15px;
    align-items: center;
    margin: 0;
    border-bottom: 1px solid var(--center-channel-color-16);

    &:hover {
        background: var(--center-channel-color-04);
    }
`;

const PlaybookItemTitle = styled.div`
    display: flex;
    flex-direction: column;

    > span {
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }
`;

const teamNameSelector = (teamId: string) => (state: GlobalState): string => getTeam(state, teamId).display_name;

const PlaybookListRow = (props: Props) => {
    const teamName = useSelector(teamNameSelector(props.playbook.team_id));
    return (
        <PlaybookItem>
            <div
                className='row'
                key={props.playbook.id}
                onClick={props.onClick}
            >
                <PlaybookItemTitle>
                <div className='col-sm-4'>
                    <TextWithTooltip
                        id={props.playbook.title}
                        text={props.playbook.title}
                    />
                    {props.displayTeam && <InfoLine>{teamName}</InfoLine>}
                </div>
                </PlaybookItemTitle>
                <div className='col-sm-2'>{props.playbook.num_stages}</div>
                <div className='col-sm-2'>{props.playbook.num_steps}</div>
                <div className='col-sm-2'>{props.playbook.num_runs}</div>
                <ActionCol>
                <div className='col-sm-2'>
                    <PlaybookActionMenu
                        onEdit={props.onEdit}
                        onDelete={props.onDelete}
                    />
                </div>
                </ActionCol>
            </div>
        </PlaybookItem>
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
                {'Edit'}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={props.onDelete}
            >
                {'Delete'}
            </DropdownMenuItem>
        </DotMenu>
    );
};

export default PlaybookListRow;
