// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {PlaybookRun} from 'src/types/playbook_run';
import {ChannelNamesMap} from 'src/types/backstage';

import TimelineEventItem from './timeline_event_item';
import {useTimelineEvents} from './timeline_utils';

interface Props {
    playbookRun: PlaybookRun;
    deleteTimelineEvent: (id: string) => void;
}

const RHSTimeline = ({playbookRun, deleteTimelineEvent}: Props) => {
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbookRun.team_id));

    const [events] = useTimelineEvents(playbookRun);

    return (
        <Container>
            {events.map((event) => (
                <TimelineEventItem
                    key={event.id}
                    event={event}
                    channelNames={channelNamesMap}
                    team={team}
                    deleteEvent={() => deleteTimelineEvent(event.id)}
                />
            ))}
        </Container>
    );
};

export default RHSTimeline;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 25px;
`;
