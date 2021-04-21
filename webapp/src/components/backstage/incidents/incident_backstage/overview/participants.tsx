// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {UserProfile} from 'mattermost-redux/types/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

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
import {navigateToUrl} from 'src/browser_routing';

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
    incident: Incident;
}

const Participants = (props: Props) => {
    const profilesInChannel = useProfilesInChannel(props.incident.channel_id);

    const profilesExceptTwoMains = profilesInChannel.filter((u) => u.id !== props.incident.commander_user_id && u.id !== props.incident.reporter_user_id);

    return (
        <TabPageContainer>
            <Title>{`Participants (${profilesInChannel.length})`}</Title>
            <StyledContent>
                <Heading>{'Commander'}</Heading>
                <Participant
                    userId={props.incident.commander_user_id}
                    isCommander={true}
                />
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

function Participant(props: { userId: string, isCommander?: boolean }) {
    const [showMessage, setShowMessage] = useState(Boolean(props.isCommander));
    const team = useSelector(getCurrentTeam);
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, props.userId));

    return (
        <ParticipantRow
            onMouseEnter={() => setShowMessage(true)}
            onMouseLeave={() => !props.isCommander && setShowMessage(false)}
        >
            <ProfileWithPosition userId={props.userId}/>
            {showMessage && (
                <SecondaryButtonRight
                    onClick={() => navigateToUrl(`/${team.name}/messages/@${user.username}`)}
                >
                    {'Message'}
                </SecondaryButtonRight>
            )}
        </ParticipantRow>
    );
}
