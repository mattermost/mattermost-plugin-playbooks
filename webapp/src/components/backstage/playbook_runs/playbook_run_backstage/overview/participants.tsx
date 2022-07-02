// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from '@mattermost/types/teams';
import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import ProfileWithPosition
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/overview/profile_w_position';
import {PlaybookRun} from 'src/types/playbook_run';
import {
    Content,
    TabPageContainer,
    Title,
} from 'src/components/backstage/playbook_runs/shared';
import {useEnsureProfiles} from 'src/hooks';

const StyledContent = styled(Content)`
    padding: 8px 20px 24px 24px;
`;

const Heading = styled.div`
    margin: 16px 0 0 0;
    font-weight: 600;
`;

const ParticipantRow = styled.div`
    display: flex;
    align-items: center;
    margin: 8px 0 0 0;
`;

interface Props {
    playbookRun: PlaybookRun;
}

const Participants = (
    {
        playbookRun,
        playbookRun: {participant_ids},
    }: Props) => {
    useEnsureProfiles(participant_ids);

    const profilesExceptTwoMains = participant_ids
        .filter((id) => id !== playbookRun.owner_user_id && id !== playbookRun.reporter_user_id);

    const {formatMessage} = useIntl();
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbookRun.team_id));

    return (
        <TabPageContainer>
            <Title>{formatMessage({defaultMessage: 'Participants ({participants})'}, {participants: participant_ids.length})}</Title>
            <StyledContent>
                <Heading>{formatMessage({defaultMessage: 'Owner'})}</Heading>
                <Participant
                    userId={playbookRun.owner_user_id}
                    isOwner={true}
                    teamName={team?.name}
                />
                <Heading>{formatMessage({defaultMessage: 'Reporter'})}</Heading>
                <Participant
                    userId={playbookRun.reporter_user_id}
                    teamName={team?.name}
                />
                {
                    profilesExceptTwoMains.length > 0 &&
                    <>
                        <Heading>{formatMessage({defaultMessage: 'Channel members'})}</Heading>
                        {profilesExceptTwoMains.map((id) => (
                            <Participant
                                key={id}
                                userId={id}
                                teamName={team?.name}
                            />
                        ))}
                    </>
                }
            </StyledContent>
        </TabPageContainer>
    );
};

export default Participants;

interface ParticipantProps {
    userId: string;
    teamName: string;
    isOwner?: boolean;
}

function Participant({userId, teamName, isOwner}: ParticipantProps) {
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, userId));

    return (
        <ParticipantRow>
            <ProfileWithPosition userId={userId}/>
        </ParticipantRow>
    );
}
