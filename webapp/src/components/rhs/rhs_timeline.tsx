// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import styled from 'styled-components';
import Scrollbars from 'react-custom-scrollbars';
import moment from 'moment';

import {GlobalState} from 'mattermost-redux/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as getUserAction} from 'mattermost-redux/actions/users';
import {UserProfile} from 'mattermost-redux/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {
    getChannelsNameMapInCurrentTeam,
    getCurrentChannelId,
} from 'mattermost-redux/selectors/entities/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {Incident} from 'src/types/incident';
import {
    TimelineEvent,
    TimelineEventsFilter,
    TimelineEventType,
} from 'src/types/rhs';
import RHSTimelineEventItem from 'src/components/rhs/rhs_timeline_event_item';
import {
    renderThumbHorizontal,
    renderThumbVertical,
    renderView,
} from 'src/components/rhs/rhs_shared';
import {ChannelNamesMap} from 'src/types/backstage';
import MultiCheckbox, {CheckboxOption} from 'src/components/multi_checkbox';
import {currentRHSEventsFilter} from 'src/selectors';
import {setRHSEventsFilter} from 'src/actions';

const Header = styled.div`
    display: flex;
    flex-direction: row;
    height: 40px;
    align-items: center;
    box-shadow: inset 0px -1px 0px var(--center-channel-color-16);
`;

const Timeline = styled.ul`
    margin: 24px 0 200px 0;
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

type IdToUserFn = (userId: string) => UserProfile;

interface Props {
    incident: Incident;
}

const RHSTimeline = (props: Props) => {
    const dispatch = useDispatch();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const displayPreference = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || 'username';
    const getStateFn = useStore().getState;
    const getUserFn = (userId: string) => getUserAction(userId)(dispatch as DispatchFunc, getStateFn);
    const selectUser = useSelector<GlobalState, IdToUserFn>((state) => (userId: string) => getUser(state, userId));
    const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
    const eventsFilter = useSelector<GlobalState, TimelineEventsFilter>(currentRHSEventsFilter);

    useEffect(() => {
        setFilteredEvents(allEvents.filter((e) => showEvent(e.event_type, eventsFilter)));
    }, [eventsFilter, allEvents]);

    const selectOption = (value: string, checked: boolean) => {
        if (eventsFilter.all && value !== 'all') {
            return;
        }

        dispatch(setRHSEventsFilter(currentChannelId, {
            ...eventsFilter,
            [value]: checked,
        }));
    };

    useEffect(() => {
        Promise.all(props.incident.timeline_events.map(async (e) => {
            let user = selectUser(e.subject_user_id) as UserProfile | undefined;

            if (!user) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ret = await getUserFn(e.subject_user_id) as { data?: UserProfile, error?: any };
                if (!ret.data) {
                    return null;
                }
                user = ret.data;
            }
            return {
                ...e,
                subject_display_name: displayUsername(user, displayPreference),
            } as TimelineEvent;
        })).then((eventArray) => {
            setAllEvents(eventArray.filter((e) => e) as TimelineEvent[]);
        });
    }, [props.incident.timeline_events, displayPreference]);

    if (props.incident.timeline_events.length === 0) {
        return (
            <NoEventsNotice>
                {'Timeline events are displayed here as they occur. Hover over an event to remove it.'}
            </NoEventsNotice>
        );
    }

    const filterOptions = [
        {
            display: 'All events',
            value: 'all',
            selected: eventsFilter.all,
            disabled: false,
        },
        {
            value: 'divider',
        } as CheckboxOption,
        {
            display: 'Commander changes',
            value: TimelineEventType.CommanderChanged,
            selected: eventsFilter.commander_changed,
            disabled: eventsFilter.all,
        },
        {
            display: 'Status updates',
            value: TimelineEventType.StatusUpdated,
            selected: eventsFilter.status_updated,
            disabled: eventsFilter.all,
        },
        {
            display: 'Events from posts',
            value: TimelineEventType.EventFromPost,
            selected: eventsFilter.event_from_post,
            disabled: eventsFilter.all,
        },
        {
            display: 'Task state changes',
            value: TimelineEventType.TaskStateModified,
            selected: eventsFilter.task_state_modified,
            disabled: eventsFilter.all,
        },
        {
            display: 'Task assignments',
            value: TimelineEventType.AssigneeChanged,
            selected: eventsFilter.assignee_changed,
            disabled: eventsFilter.all,
        },
        {
            display: 'Slash commands',
            value: TimelineEventType.RanSlashCommand,
            selected: eventsFilter.ran_slash_command,
            disabled: eventsFilter.all,
        },
        {
            display: 'User activities',
            value: TimelineEventType.UserJoinedLeft,
            selected: eventsFilter.user_joined_left,
            disabled: eventsFilter.all,
        },
    ];

    let timeline = null;
    if (filteredEvents.length > 0) {
        timeline = (
            <Timeline data-testid='timeline-view'>
                {
                    filteredEvents.map((event) => (
                        <RHSTimelineEventItem
                            key={event.id}
                            event={event}
                            reportedAt={moment(props.incident.create_at)}
                            channelNames={channelNamesMap}
                            team={team}
                        />
                    ))
                }
            </Timeline>
        );
    }

    return (
        <>
            <Header>
                <MultiCheckbox
                    options={filterOptions}
                    onselect={selectOption}
                />
            </Header>
            <Scrollbars
                autoHide={true}
                autoHideTimeout={500}
                autoHideDuration={500}
                renderThumbHorizontal={renderThumbHorizontal}
                renderThumbVertical={renderThumbVertical}
                renderView={renderView}
                style={{position: 'absolute'}}
            >
                {timeline}
            </Scrollbars>
        </>
    );
};

export default RHSTimeline;

const showEvent = (eventType: string, filter: TimelineEventsFilter) => {
    if (filter.all) {
        return true;
    }
    const filterRecord = filter as unknown as Record<string, boolean>;
    return filterRecord[eventType] ||
        (eventType === TimelineEventType.IncidentCreated && filterRecord[TimelineEventType.StatusUpdated]);
};
