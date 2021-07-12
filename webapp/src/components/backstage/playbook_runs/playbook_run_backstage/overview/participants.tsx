// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {UserProfile} from 'mattermost-redux/types/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import ProfileWithPosition
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/overview/profile_w_position';

import {PlaybookRun} from 'src/types/playbook_run';

import {
    Content,
    SecondaryButtonRight,
    TabPageContainer,
    Title,
} from 'src/components/backstage/playbook_runs/shared';

import {useProfilesInChannel} from 'src/hooks';
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
    playbookRun: PlaybookRun;
}

const Participants = (props: Props) => {
    const profilesInChannel = useProfilesInChannel(props.playbookRun.channel_id);

    const profilesExceptTwoMains = profilesInChannel.filter((u) => u.id !== props.playbookRun.owner_user_id && u.id !== props.playbookRun.reporter_user_id);

    return (
        <TabPageContainer>
            <Title>{`Participants (${profilesInChannel.length})`}</Title>
            <StyledContent>
                <Heading>{'Owner'}</Heading>
                <Participant
                    userId={props.playbookRun.owner_user_id}
                    isOwner={true}
                />
                <Heading>{'Reporter'}</Heading>
                <Participant userId={props.playbookRun.reporter_user_id}/>
                {
                    profilesExceptTwoMains.length > 0 &&
                    <>
                        <Heading>{'Channel members'}</Heading>
                        {profilesExceptTwoMains.map((o) => (
                            <Participant
                                key={o.id}
                                userId={o.id}
                            />
                        ))}
                    </>
                }
            </StyledContent>
        </TabPageContainer>
    );
};

export default Participants;

function Participant(props: { userId: string, isOwner?: boolean }) {
    const [showMessage, setShowMessage] = useState(Boolean(props.isOwner));
    const team = useSelector(getCurrentTeam);
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, props.userId));

    return (
        <ParticipantRow
            onMouseEnter={() => setShowMessage(true)}
            onMouseLeave={() => !props.isOwner && setShowMessage(false)}
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
