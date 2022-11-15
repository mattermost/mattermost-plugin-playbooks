// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {BookOutlineIcon} from '@mattermost/compass-icons/components';

import Profile from 'src/components/profile/profile';

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
}

const RunsList = styled.div`
    display: flex;
    flex-direction: column;
    padding: 0px 16px;
    gap: 12px;
`;

const RHSRunList = (props: Props) => {
    return (
        <RunsList>
            {props.runs.map((run: RunToDisplay) => (
                <RHSRunListCard
                    key={run.id}
                    {...run}
                />
            ))}
        </RunsList>
    );
};

const CardContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 16px 20px 20px;
    border: 1px solid rgba(var(--center-channel-text-rgb), 0.08);
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    gap: 8px;
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

const RHSRunListCard = (props: RunToDisplay) => {
    const {formatMessage} = useIntl();

    return (
        <CardContainer>
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
