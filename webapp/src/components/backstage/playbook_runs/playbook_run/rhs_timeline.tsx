// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {DateTime} from 'luxon';

import TimelineEventItem from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/timeline_event_item';
import {PlaybookRun} from 'src/types/playbook_run';
import {ChannelNamesMap} from 'src/types/backstage';

import {useTimelineEvents} from './timeline_utils';

interface Props {
    playbookRun: PlaybookRun;
    deleteTimelineEvent: (id: string) => void;
}

const RHSTimeline = ({playbookRun, deleteTimelineEvent}: Props) => {
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbookRun.team_id));

    const [filteredEvents] = useTimelineEvents(playbookRun);

    return (
        <Container data-testid='timeline-view'>
            {filteredEvents.map((event, i, events) => {
                let prevEventAt;
                if (i !== events.length - 1) {
                    prevEventAt = DateTime.fromMillis(events[i + 1].event_at);
                }
                return (
                    <TimelineEventItem
                        key={event.id}
                        event={event}
                        prevEventAt={prevEventAt}
                        prevEventAtPosition={'bottom'}
                        runCreateAt={DateTime.fromMillis(playbookRun.create_at)}
                        channelNames={channelNamesMap}
                        team={team}
                        deleteEvent={() => deleteTimelineEvent(event.id)}
                    />
                );
            })}
        </Container>
    );
};

export default RHSTimeline;

const Container = styled.ul`
    margin: 24px 0;
    padding: 0 0 40px 0;
    list-style: none;
    position: relative;

    :before {
        content: '';
        position: absolute;
        top: 5px;
        left: 32px;
        width: 1px;
        bottom: -10px;
        background: #EFF1F5;
    }
`;
