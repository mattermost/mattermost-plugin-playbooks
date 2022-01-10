// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {useSelector} from 'react-redux';

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
    onArchive: () => void
}

const ActionCol = styled.div`
    margin-left: -8px;
	width: 16.666667%;
	float: left;
    position: relative;
	min-height: 1px;
	padding-left: 15px;
	padding-right: 15px;
	cursor: pointer;
`;

const PlaybookItem = styled.div`
    cursor: pointer;
    display: flex;
    padding-top: 15px;
    padding-bottom: 15px;
    align-items: center;
    margin: 0;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
`;

const PlaybookItemTitle = styled.div`
    display: flex;
	font-weight: 600;
    flex-direction: column;
    position: relative;
    width: 33.333333%;
    min-height: 1px;
    padding-right: 15px;
    padding-left: 15px;
	float: left;
`;

const PlaybookItemRow = styled.div`
	width: 16.666667%;
	float: left;
    position: relative;
	min-height: 1px;
	padding-left: 15px;
	padding-right: 15px;
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
            <PlaybookItemRow>{props.playbook.num_stages}</PlaybookItemRow>
            <PlaybookItemRow>{props.playbook.num_steps}</PlaybookItemRow>
            <PlaybookItemRow>{props.playbook.num_runs}</PlaybookItemRow>
            <ActionCol>
                <PlaybookActionMenu
                    onEdit={props.onEdit}
                    onArchive={props.onArchive}
                />
            </ActionCol>
        </PlaybookItem>
    );
};

interface PlaybookActionMenuProps {
    onEdit: () => void;
    onArchive: () => void;
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
                onClick={props.onArchive}
            >
                <FormattedMessage defaultMessage='Archive'/>
            </DropdownMenuItem>
        </DotMenu>
    );
};

export default PlaybookListRow;
