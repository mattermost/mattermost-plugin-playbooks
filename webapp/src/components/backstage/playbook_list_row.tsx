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
    position: relative;
    width: 100%;
    min-height: 1px;
    padding-right: 15px;
    padding-left: 15px;
    @media (min-width: 576){
        -webkit-box-flex: 0;
        flex: 0 0 16.666667%;
        max-width: 16.666667%;
    }
`;

const PlaybookItem = styled.div`
    cursor: pointer;
    display: flex;
    padding-top: 15px;
    padding-bottom: 15px;
    align-items: center;
    margin: 0;
    border-bottom: 1px solid var(--center-channel-color-16);
    flex-wrap: wrap;
    margin-right: -15px;
    margin-left: -15px;
    &:hover {
        background: var(--center-channel-color-04);
    }
`;

const PlaybookItemTitle = styled.div`
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    min-height: 1px;
    padding-right: 15px;
    padding-left: 15px;
    > span {
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }
    @media (min-width: 576){
        -webkit-box-flex: 0;
        flex: 0 0 33.333333%;
        max-width: 33.333333%;
    }
`;

const teamNameSelector = (teamId: string) => (state: GlobalState): string => getTeam(state, teamId).display_name;

const PlaybookListRow = (props: Props) => {
    const teamName = useSelector(teamNameSelector(props.playbook.team_id));
    return (
        <PlaybookItem
            key={props.playbook.id}
            onClick={props.onClick}
        >
            <PlaybookItemTitle>
                <TextWithTooltip
                    id={props.playbook.title}
                    text={props.playbook.title}
                />
                {props.displayTeam && <InfoLine>{teamName}</InfoLine>}
            </PlaybookItemTitle>
            <div className='col-sm-2'>{props.playbook.num_stages}</div>
            <div className='col-sm-2'>{props.playbook.num_steps}</div>
            <div className='col-sm-2'>{props.playbook.num_runs}</div>
            <ActionCol>
                <PlaybookActionMenu
                    onEdit={props.onEdit}
                    onDelete={props.onDelete}
                />
            </ActionCol>
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
