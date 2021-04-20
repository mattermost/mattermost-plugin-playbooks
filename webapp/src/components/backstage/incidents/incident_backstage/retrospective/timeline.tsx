// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import moment from 'moment';

import {GlobalState} from 'mattermost-redux/types/store';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {Incident} from 'src/types/incident';
import {TimelineEvent} from 'src/types/rhs';
import RHSTimelineEventItem from 'src/components/rhs/rhs_timeline_event_item';
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
        left: 97px;
        width: 1px;
        background: #EFF1F5;
    }
`;

const NoEventsNotice = styled.div`
    margin: 35px 20px 0 20px;
    font-size: 14px;
    font-weight: 600;
`;

interface Props {
    incident: Incident;
    filteredEvents: TimelineEvent[];
}

const Timeline = (props: Props) => {
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);

    if (props.incident.timeline_events.length === 0) {
        return (
            <NoEventsNotice>
                {'Timeline events are displayed here as they occur. Hover over an event to remove it.'}
            </NoEventsNotice>
        );
    }

    return (
        <TimelineLine data-testid='timeline-view'>
            {
                props.filteredEvents.map((event) => (
                    <RHSTimelineEventItem
                        key={event.id}
                        event={event}
                        reportedAt={moment(props.incident.create_at)}
                        channelNames={channelNamesMap}
                        team={team}
                    />
                ))
            }
        </TimelineLine>
    );
};

export default Timeline;
