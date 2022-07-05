// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import {DateTime} from 'luxon';
import {useIntl} from 'react-intl';

import {GlobalState} from '@mattermost/types/store';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {Team} from '@mattermost/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {PlaybookRun} from 'src/types/playbook_run';

import {TimelineEvent} from 'src/types/rhs';
import TimelineEventItem from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/timeline_event_item';
import {ChannelNamesMap} from 'src/types/backstage';

const TimelineLine = styled.ul`
    margin: 24px 0;
    padding: 0;
    list-style: none;
    position: relative;

    :before {
        content: '';
        position: absolute;
        top: 5px;
        bottom: -10px;
        left: 32px;
        width: 1px;
        background: #EFF1F5;
    }
`;

const NoEventsNotice = styled.div`
    margin: 35px 20px 35px;
    font-size: 14px;
    font-weight: 600;
`;

interface Props {
    playbookRun: PlaybookRun;
    filteredEvents: TimelineEvent[];
    deleteTimelineEvent: (id: string) => void;
}

const Timeline = (props: Props) => {
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, props.playbookRun.team_id));
    const {formatMessage} = useIntl();

    if (props.playbookRun.timeline_events.length === 0) {
        return (
            <NoEventsNotice>
                {formatMessage({defaultMessage: 'Timeline events are displayed here as they occur. Hover over an event to remove it.'})}
            </NoEventsNotice>
        );
    }

    if (props.filteredEvents.length === 0) {
        return (
            <NoEventsNotice>
                {formatMessage({defaultMessage: 'There are no Timeline events matching those filters.'})}
            </NoEventsNotice>
        );
    }

    return (
        <TimelineLine data-testid='timeline-view'>
            {props.filteredEvents.map((event, i, events) => {
                let prevEventAt;
                if (i !== 0) {
                    prevEventAt = DateTime.fromMillis(events[i - 1].event_at);
                }
                return (
                    <TimelineEventItem
                        key={event.id}
                        event={event}
                        parent={'retro'}
                        prevEventAt={prevEventAt}
                        runCreateAt={DateTime.fromMillis(props.playbookRun.create_at)}
                        channelNames={channelNamesMap}
                        team={team}
                        deleteEvent={() => props.deleteTimelineEvent(event.id)}
                        editable={true}
                    />
                );
            })}
        </TimelineLine>
    );
};

export default Timeline;
