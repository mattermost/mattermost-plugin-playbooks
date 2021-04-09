// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {Incident} from 'src/types/incident';
import ProfileWithPosition
    from 'src/components/backstage/incidents/incident_backstage/overview/profile_w_position';
import {useProfilesInChannel} from 'src/hooks';
import {
    Content,
    SecondaryButtonRight,
    TabPageContainer,
    Title,
} from 'src/components/backstage/incidents/shared';

const StyledContent = styled(Content)`
    padding: 10px 20px;
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
    incident: Incident;
}

const Participants = (props: Props) => {
    const profilesInChannel = useProfilesInChannel(props.incident.channel_id);

    const profilesExceptTwoMains = profilesInChannel.filter((u) => u.id !== props.incident.commander_user_id && u.id !== props.incident.reporter_user_id);

    return (
        <TabPageContainer>
            <Title>{'Participants'}</Title>
            <StyledContent>
                <Heading>{'Commander'}</Heading>
                <Participant userId={props.incident.commander_user_id}/>
                <Heading>{'Reporter'}</Heading>
                <Participant userId={props.incident.reporter_user_id}/>
                <Heading>{'Channel Members'}</Heading>
                {profilesExceptTwoMains.map((o) => (
                    <Participant
                        key={o.id}
                        userId={o.id}
                    />
                ))}
            </StyledContent>
        </TabPageContainer>
    );
};

export default Participants;

function Participant(props: { userId: string }) {
    const [showMessage, setShowMessage] = useState(false);

    return (
        <ParticipantRow
            onMouseEnter={() => setShowMessage(true)}
            onMouseLeave={() => setShowMessage(false)}
        >
            <ProfileWithPosition userId={props.userId}/>
            {showMessage && <SecondaryButtonRight>{'Message'}</SecondaryButtonRight>}
        </ParticipantRow>
    );
}
