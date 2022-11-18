// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {BookOutlineIcon, FilterVariantIcon, PlayOutlineIcon} from '@mattermost/compass-icons/components';

import {useDispatch} from 'react-redux';

import Profile from 'src/components/profile/profile';

import DotMenu, {DotMenuButton, DropdownMenuItem, TitleButton} from 'src/components/dot_menu';

import {SecondaryButton} from '../assets/buttons';
import {openPlaybookRunModal} from 'src/actions';

import {RHSTitleRemoteRender} from 'src/rhs_title_remote_render';

import {UserList} from './rhs_participants';

interface PlaybookToDisplay {
    title: string
}

interface RunToDisplay {
    id: string
    name: string
    participantIDs: string[]
    ownerUserID: string
    playbook: PlaybookToDisplay
    lastUpdatedAt: number
}

interface Props {
    runs: RunToDisplay[];
    onSelectRun: (runID: string) => void
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 12px 16px;
    gap: 4px;
`;

const RunsList = styled.div`
    display: flex;
    flex-direction: column;
    padding: 0px 16px;
    gap: 12px;
`;

const FilterMenuTitle = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
`;

const Spacer = styled.div`
    flex-grow: 1;
`;

const StartRunButton = styled(SecondaryButton)`
    display: flex;
    flex-direction: row;
    gap: 6px;
    padding: 8px 16px;

    border: 0;
    height: 100%;
    font-weight: 600;
    font-size: 12px;
    color: var(--button-bg);
    background: rgba(var(--button-bg-rgb), 0.08);
`;

const SortDotMenuButton = styled(DotMenuButton)`
    justify-content: center;
    align-items: center;
`;

const SortAscendingIcon = FilterVariantIcon;

const RHSTitleText = styled.div<{ clickable?: boolean }>`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;

    overflow: hidden;
    text-overflow: ellipsis;

    border-radius: 4px;

    ${(props) => props.clickable && css`
        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            fill: rgba(var(--center-channel-color-rgb), 0.72);
        }

        &:active,
        &--active,
        &--active:hover {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
        }
    `}
`;

const RHSRunList = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    return (
        <>
            <RHSTitleRemoteRender>
                <RHSTitleText>
                    {/* product name; don't translate */}
                    {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                    {'Playbooks'}
                </RHSTitleText>
            </RHSTitleRemoteRender>
            <Container>
                <Header>
                    <DotMenu
                        dotMenuButton={TitleButton}
                        placement='bottom-start'
                        icon={
                            <FilterMenuTitle>
                                {formatMessage({defaultMessage: 'Runs in progress'})}
                                <i className={'icon icon-chevron-down'}/>
                            </FilterMenuTitle>
                        }
                    >
                        <DropdownMenuItem
                            onClick={() => console.log('testing')}
                        >
                            {formatMessage({defaultMessage: 'Runs in progress'})}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => console.log('testing')}
                        >
                            {formatMessage({defaultMessage: 'Finished runs'})}
                        </DropdownMenuItem>
                    </DotMenu>
                    <Spacer/>
                    <StartRunButton
                        onClick={() => dispatch(openPlaybookRunModal())}
                    >
                        <PlayOutlineIcon size={14}/>
                        {formatMessage({defaultMessage: 'Start run'})}
                    </StartRunButton>
                    <DotMenu
                        dotMenuButton={SortDotMenuButton}
                        placement='bottom-start'
                        icon={<SortAscendingIcon/>}
                    >
                        <DropdownMenuItem
                            onClick={() => console.log('testing')}
                        >
                            {formatMessage({defaultMessage: 'Recently created'})}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => console.log('testing')}
                        >
                            {formatMessage({defaultMessage: 'Recently updated'})}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => console.log('testing')}
                        >
                            {formatMessage({defaultMessage: 'Alphabetically'})}
                        </DropdownMenuItem>
                    </DotMenu>
                </Header>
                <RunsList>
                    {props.runs.map((run: RunToDisplay) => (
                        <RHSRunListCard
                            key={run.id}
                            onClick={() => props.onSelectRun(run.id)}
                            {...run}
                        />
                    ))}
                </RunsList>
            </Container>
        </>
    );
};

const CardContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 16px 20px 20px;
    border: 1px solid rgba(var(--center-channel-text-rgb), 0.08);
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
    color: rgba(var(--center-channel-text-rgb), 0.64);
`;
const PlaybookChip = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0px 4px;
    gap: 4px;

    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    color: rgba(var(--center-channel-text-rgb), 0.72);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 40%;

    background: rgba(var(--center-channel-text-rgb), 0.08);
    border-radius: 4px;
`;
const OwnerProfileChip = styled(Profile)`
    flex-grow: 0;

    font-weight: 400;
    font-size: 11px;
    line-height: 15px;
    padding: 2px 10px 2px 2px;
    background: rgba(var(--center-channel-text-rgb), 0.08);
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

interface RHSRunListCardProps extends RunToDisplay {
    onClick: () => void
}

const RHSRunListCard = (props: RHSRunListCardProps) => {
    const {formatMessage} = useIntl();

    return (
        <CardContainer
            onClick={props.onClick}
        >
            <TitleRow>{props.name}</TitleRow>
            <PeopleRow>
                <OwnerProfileChip userId={props.ownerUserID}/>
                <ParticipantsProfiles>
                    <UserList
                        userIds={props.participantIDs}
                        sizeInPx={20}
                    />
                </ParticipantsProfiles>
            </PeopleRow>
            <InfoRow>
                <LastUpdatedText>{formatMessage({defaultMessage: 'Last status update {time}'}, {time: '8 hours ago'})}</LastUpdatedText>
                <PlaybookChip>
                    <StyledBookOutlineIcon
                        size={11}
                    />
                    {props.playbook.title}
                </PlaybookChip>
            </InfoRow>
        </CardContainer>
    );
};

export default RHSRunList;
