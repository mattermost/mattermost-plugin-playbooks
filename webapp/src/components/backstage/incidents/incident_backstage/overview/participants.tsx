// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {
    Content,
    SecondaryButtonRight,
    TabPageContainer,
    Title,
} from 'src/components/backstage/incidents/incident_backstage/shared';
import {Incident} from 'src/types/incident';
import ProfileWithPosition
    from 'src/components/backstage/incidents/incident_backstage/overview/profile_w_position';
import {useProfilesInChannel} from 'src/hooks';

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

    const profilesExceptCommander = profilesInChannel.filter((u) => u.id !== props.incident.commander_user_id);
    const observers = profilesExceptCommander.slice(0, Math.min(2, profilesExceptCommander.length));
    const subscribers = profilesExceptCommander.slice(Math.min(2, profilesExceptCommander.length));

    return (
        <TabPageContainer>
            <Title>{'Participants'}</Title>
            <StyledContent>
                <Heading>{'Commander'}</Heading>
                <Participant userId={props.incident.commander_user_id}/>
                <Heading>{'Reporter'}</Heading>
                <Participant userId={props.incident.reporter_user_id}/>
                <Heading>{'Observers'}</Heading>
                {observers.map((o) => (
                    <Participant
                        key={o.id}
                        userId={o.id}
                    />
                ))}
                <Heading>{'Subscribers'}</Heading>
                {subscribers.map((o) => (
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
