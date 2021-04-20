// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import styled from 'styled-components';

import {GlobalState} from 'mattermost-redux/types/store';
import {UserProfile} from 'mattermost-redux/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUser as getUserAction} from 'mattermost-redux/actions/users';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {Incident} from 'src/types/incident';
import Timeline from 'src/components/backstage/incidents/incident_backstage/retrospective/timeline';
import MultiCheckbox, {CheckboxOption} from 'src/components/multi_checkbox';
import {TimelineEvent, TimelineEventsFilter, TimelineEventType} from 'src/types/rhs';
import {setRHSEventsFilter} from 'src/actions';
import {rhsEventsFilterForChannel} from 'src/selectors';
import {
    Content,
    PrimaryButtonRight,
    TabPageContainer,
    Title,
} from 'src/components/backstage/incidents/shared';

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const FakeButton = styled.div`
    display: inline-flex;
    align-items: center;
    color: var(--button-bg);
    background: white;
    border: 1px solid var(--button-bg);
    border-radius: 4px;
    padding: 0 14px;
    height: 26px;
    font-weight: 600;
    font-size: 12px;
    transition: all 0.15s ease-out;
    margin-left: auto;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }

    &:active  {
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    i {
        display: flex;
        font-size: 18px;

        &:before {
            margin: 0 7px 0 0;
        }
    }
`;

const PrimaryButtonNotRight = styled(PrimaryButtonRight)`
    margin-left: 20px;
`;

type IdToUserFn = (userId: string) => UserProfile;

const TimelineRetro = (props: { incident: Incident }) => {
    const dispatch = useDispatch();
    const displayPreference = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || 'username';
    const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
    const eventsFilter = useSelector<GlobalState, TimelineEventsFilter>((state) => rhsEventsFilterForChannel(state, props.incident.channel_id));
    const getStateFn = useStore().getState;
    const getUserFn = (userId: string) => getUserAction(userId)(dispatch as DispatchFunc, getStateFn);
    const selectUser = useSelector<GlobalState, IdToUserFn>((state) => (userId: string) => getUser(state, userId));

    useEffect(() => {
        setFilteredEvents(allEvents.filter((e) => showEvent(e.event_type, eventsFilter)));
    }, [eventsFilter, allEvents]);

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

    const selectOption = (value: string, checked: boolean) => {
        if (eventsFilter.all && value !== 'all') {
            return;
        }

        dispatch(setRHSEventsFilter(props.incident.channel_id, {
            ...eventsFilter,
            [value]: checked,
        }));
    };

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
            display: 'Saved messages',
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
            value: 'divider',
        } as CheckboxOption,
        {
            display: 'Jira issue updates',
            value: 'jira',
            selected: eventsFilter.jira,
            disabled: eventsFilter.all,
        },
        {
            display: 'Zendesk ticket updates',
            value: 'zendesk',
            selected: eventsFilter.zendesk,
            disabled: eventsFilter.all,
        },
        {
            display: 'Github code changes',
            value: 'github',
            selected: eventsFilter.github,
            disabled: eventsFilter.all,
        },
    ];

    return (
        <TabPageContainer>
            <Header>
                <Title>{'Timeline'}</Title>
                <FakeButton>
                    <MultiCheckbox
                        options={filterOptions}
                        onselect={selectOption}
                    />
                    {'Filter'}
                </FakeButton>
                <PrimaryButtonNotRight>
                    <i className='icon-download-outline'/>
                    {'Export'}
                </PrimaryButtonNotRight>
            </Header>
            <Content>
                <Timeline
                    incident={props.incident}
                    filteredEvents={filteredEvents}
                />
            </Content>
        </TabPageContainer>
    );
};

export default TimelineRetro;

const showEvent = (eventType: string, filter: TimelineEventsFilter) => {
    if (filter.all) {
        return true;
    }
    const filterRecord = filter as unknown as Record<string, boolean>;
    return filterRecord[eventType] ||
        (eventType === TimelineEventType.IncidentCreated && filterRecord[TimelineEventType.StatusUpdated]);
};
