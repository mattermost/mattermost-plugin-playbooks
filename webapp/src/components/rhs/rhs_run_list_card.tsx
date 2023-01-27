// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FormattedMessage, useIntl} from 'react-intl';
import React, {useState} from 'react';

import {useDispatch, useSelector} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import {
    BookOutlineIcon,
    CheckAllIcon,
    LinkVariantIcon,
    PencilOutlineIcon,
    PlayOutlineIcon,
} from '@mattermost/compass-icons/components';

import {DateTime} from 'luxon';

import styled from 'styled-components';

import {useToaster} from 'src/components/backstage/toast_banner';

import {useUpdateRun} from 'src/graphql/hooks';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

import {ToastStyle} from 'src/components/backstage/toast';
import {UserList} from 'src/components/rhs/rhs_participants';
import Profile from 'src/components/profile/profile';
import {IconWrapper, Spacer, StyledDropdownMenuItem} from 'src/components/rhs/styles';
import DotMenu, {DotMenuButton} from 'src/components/dot_menu';
import {openUpdateRunChannelModal, openUpdateRunNameModal} from 'src/actions';
import {navigateToPluginUrl} from 'src/browser_routing';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';

interface PlaybookToDisplay {
    title: string
}

export interface RunToDisplay {
    id: string
    name: string
    participantIDs: string[]
    ownerUserID: string
    playbookID: string
    playbook?: Maybe<PlaybookToDisplay>
    numTasksClosed: number
    numTasks: number
    lastUpdatedAt: number
    type: PlaybookRunType
}

interface RHSRunListCardProps extends RunToDisplay {
    onClick: () => void;
    onLinkRunToChannel: () => void;
}

export const RHSRunListCard = (props: RHSRunListCardProps) => {
    const {formatMessage} = useIntl();
    const [removed, setRemoved] = useState(false);
    const {add: addToastMessage} = useToaster();
    const teamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);
    const canEditRun = currentUserId === props.ownerUserID || props.participantIDs.includes(currentUserId);
    const participantIdsWithoutOwner = props.participantIDs.filter((id) => id !== props.ownerUserID);
    const [movedChannel, setMovedChannel] = useState({channelId: '', channelName: ''});
    const updateRun = useUpdateRun(props.id);
    const isPlaybookRun = props.type === PlaybookRunType.Playbook;
    const icon = isPlaybookRun ? <PlayOutlineIcon size={22}/> : <CheckAllIcon size={22}/>;

    return (
        <CardWrapper
            progress={(props.numTasksClosed / props.numTasks) * 100}
            className={removed ? 'removed' : ''}
            onAnimationEnd={() => {
                if (!movedChannel.channelId) {
                    return;
                }
                updateRun({channelID: movedChannel.channelId});
                addToastMessage({
                    content: isPlaybookRun ? formatMessage({defaultMessage: 'Run moved to {channel}'}, {channel: movedChannel.channelName}) : formatMessage({defaultMessage: 'Checklist moved to {channel}'}, {channel: movedChannel.channelName}),
                    toastStyle: ToastStyle.Success,
                });
                props.onLinkRunToChannel();
            }}
        >
            <CardContainer
                onClick={props.onClick}
                data-testid='run-list-card'
            >
                <CardTitleContainer>
                    <IconWrapper margin='6px'>
                        {icon}
                    </IconWrapper>
                    <TitleRow>{props.name}</TitleRow>
                    <Spacer/>
                    {isPlaybookRun &&
                        <RunContextMenu
                            playbookID={props.playbookID}
                            playbookTitle={props.playbook?.title || ''}
                            playbookRunID={props.id}
                            teamID={teamId}
                            canSeePlaybook={Boolean(props.playbook?.title)}
                            canEditRun={canEditRun}
                            onUpdateName={(newName) => {
                                updateRun({name: newName});
                            }}
                            onUpdateChannel={(newChannelId: string, newChannelName: string) => {
                                setRemoved(true);
                                setMovedChannel({
                                    channelId: newChannelId,
                                    channelName: newChannelName,
                                });
                            }}
                        />
                    }
                    {!isPlaybookRun &&
                        <ChannelChecklistContextMenu
                            playbookRunID={props.id}
                            teamID={teamId}
                            canEditRun={canEditRun}
                            onUpdateName={(newName) => {
                                updateRun({name: newName});
                            }}
                            onUpdateChannel={(newChannelId: string, newChannelName: string) => {
                                setRemoved(true);
                                setMovedChannel({
                                    channelId: newChannelId,
                                    channelName: newChannelName,
                                });
                            }}
                        />
                    }
                </CardTitleContainer>
                {isPlaybookRun &&
                    <PeopleRow>
                        <OwnerProfileChip userId={props.ownerUserID}/>
                        <ParticipantsProfiles>
                            <UserList
                                userIds={participantIdsWithoutOwner}
                                sizeInPx={20}
                            />
                        </ParticipantsProfiles>
                    </PeopleRow>
                }
                {!isPlaybookRun && props.numTasks > 0 &&
                    <TasksDone>
                        <TasksDoneNumbers>
                            {/* eslint-disable formatjs/no-literal-string-in-jsx */}
                            {props.numTasksClosed + '/' + props.numTasks}
                        </TasksDoneNumbers>
                        <TasksDoneText>
                            {formatMessage({defaultMessage: 'tasks done'})}
                        </TasksDoneText>
                    </TasksDone>
                }
                <InfoRow>
                    <LastUpdatedText>
                        {formatMessage(
                            {defaultMessage: 'Last updated {time}'},
                            {time: DateTime.fromMillis(props.lastUpdatedAt).toRelative()}
                        )}
                    </LastUpdatedText>
                    {props.playbook && isPlaybookRun &&
                        <PlaybookChip>
                            <StyledBookOutlineIcon
                                size={11}
                            />
                            <PlaybookChipText>{props.playbook.title}</PlaybookChipText>
                        </PlaybookChip>
                    }
                </InfoRow>
            </CardContainer>
        </CardWrapper>
    );
};

const CardWrapper = styled.div<{ progress: number }>`
    margin: 0;
    padding:0;
    border-radius: 4px;
    position: relative;

    &:after {
        content: '';
        display: block;
        position: absolute;
        right: calc(${({progress}) => 100 - progress}% + 1px);
        bottom: 1px;
        left: 1px;
        border-bottom: 2px solid var(--online-indicator);
        border-bottom-left-radius: inherit;
        border-bottom-right-radius: ${({progress}) => (progress < 100 ? 0 : 'inherit')}
    }

    &.removed {
        -webkit-animation: disapear 0.7s;
        -webkit-animation-fill-mode: forwards;
        animation: disapear 0.7s;
        animation-fill-mode: forwards;
    }

    @-webkit-keyframes disapear{
        35% {
            -webkit-transform: translateY(5%);
            transform: translateY(5%);
        }
        100% {
            -webkit-transform: translateY(-1000%);
            transform: translateY(-1000%);
        }
    }

    @keyframes disapear{
        35% {
            -webkit-transform: translateY(5%);
            transform: translateY(5%);
        }
        100% {
            -webkit-transform: translateY(-1000%);
            transform: translateY(-1000%);
        }
    }
`;

const CardContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 16px 20px 20px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    box-shadow: 0px 2px 3px 0px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    gap: 8px;

    cursor: pointer;

    &:hover {
        box-shadow: 0px 4px 6px 0px rgba(0, 0, 0, 0.12);
    }

    &:active {
        box-shadow: inset 0px 2px 3px rgba(0, 0, 0, 0.08);
    }
`;
const CardTitleContainer = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;

`;
const TitleRow = styled.div`
    font-size: 14px;
    font-weight: 600;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;
const PeopleRow = styled.div`
    display: flex;
    flex-direction: row;
    gap: 4px;
`;
const InfoRow = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`;
const LastUpdatedText = styled.div`
    font-size: 11px;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;
const PlaybookChip = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0px 4px;
    gap: 4px;
    max-width: 40%;

    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;
const PlaybookChipText = styled.span`
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const OwnerProfileChip = styled(Profile)`
    flex-grow: 0;

    font-weight: 400;
    font-size: 11px;
    line-height: 15px;
    padding: 2px 10px 2px 2px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 12px;

    > .image {
        width: 16px;
        height: 16px;
    }
`;
const ParticipantsProfiles = styled.div`
    display: flex;
    flex-direction: row;
`;

const StyledBookOutlineIcon = styled(BookOutlineIcon)`
    flex-shrink: 0;
`;

const TasksDone = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 11px;
`;

const TasksDoneNumbers = styled.div`
    margin-right: 6px;
    font-weight: 600;
`;

const TasksDoneText = styled.div`
    font-weight: 400;
`;

interface RunContextMenuProps {
    playbookID: string;
    teamID: string;
    playbookRunID: string;
    playbookTitle: string;
    canSeePlaybook: boolean;
    canEditRun: boolean;
    onUpdateChannel: (channelId: string, channelName: string) => void;
    onUpdateName: (name: string) => void;
}
const RunContextMenu = (props: RunContextMenuProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const overviewURL = `/runs/${props.playbookRunID}?from=channel_rhs_dotmenu`;
    const playbookURL = `/playbooks/${props.playbookID}`;

    return (
        <DotMenu
            dotMenuButton={StyledDotMenuButton}
            placement='bottom-start'
            icon={<ThreeDotsIcon/>}
        >
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunChannelModal(props.playbookRunID, props.teamID, PlaybookRunType.Playbook, props.onUpdateChannel))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this run'})}
            >
                <IconWrapper>
                    <LinkVariantIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Link run to a different channel'/>
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunNameModal(props.playbookRunID, props.teamID, PlaybookRunType.Playbook, props.onUpdateName))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this run'})}
            >
                <IconWrapper>
                    <PencilOutlineIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Rename run'/>
            </StyledDropdownMenuItem>
            <Separator/>
            <StyledDropdownMenuItem onClick={() => navigateToPluginUrl(overviewURL)}>
                <IconWrapper>
                    <PlayOutlineIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Go to run overview'/>
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem
                disabled={!props.canSeePlaybook}
                onClick={() => navigateToPluginUrl(playbookURL)}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to see this playbook'})}
            >
                <RowContainer>
                    <ColContainer>
                        <IconWrapper>
                            <BookOutlineIcon size={22}/>
                        </IconWrapper>
                        <FormattedMessage defaultMessage='Go to playbook'/>
                    </ColContainer>
                    <MenuItemSubTitle>{props.playbookTitle}</MenuItemSubTitle>
                </RowContainer>
            </StyledDropdownMenuItem>
        </DotMenu>
    );
};

interface ChannelChecklistContextMenuProps {
    teamID: string;
    playbookRunID: string;
    canEditRun: boolean;
    onUpdateChannel: (channelId: string, channelName: string) => void;
    onUpdateName: (name: string) => void;
}
const ChannelChecklistContextMenu = (props: ChannelChecklistContextMenuProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    return (
        <DotMenu
            dotMenuButton={StyledDotMenuButton}
            placement='bottom-start'
            icon={<ThreeDotsIcon/>}
        >
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunChannelModal(props.playbookRunID, props.teamID, PlaybookRunType.ChannelChecklist, props.onUpdateChannel))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this checklist'})}
            >
                <IconWrapper>
                    <LinkVariantIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Link checklist to a different channel'/>
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunNameModal(props.playbookRunID, props.teamID, PlaybookRunType.ChannelChecklist, props.onUpdateName))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this checklist'})}
            >
                <IconWrapper>
                    <PencilOutlineIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Rename checklist'/>
            </StyledDropdownMenuItem>
        </DotMenu>
    );
};

const ColContainer = styled.div`
    display: flex;
    flex-direction: row;
`;

const RowContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const MenuItemSubTitle = styled.div`
    margin-left: 33px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    // don't let the playbook title make context menu grow too wide
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const StyledDotMenuButton = styled(DotMenuButton)`
    width: 28px;
    height: 28px;
`;

const Separator = styled.hr`
    display: flex;
    align-content: center;
    border-top: 1px solid var(--center-channel-color-08);
    margin: 5px auto;
    width: 100%;
`;

const ThreeDotsIcon = styled(HamburgerButton)`
    font-size: 18px;
    margin-left: 1px;
`;
