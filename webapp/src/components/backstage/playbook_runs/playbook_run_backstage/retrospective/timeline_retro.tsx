// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUser as getUserAction} from 'mattermost-redux/actions/users';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import Timeline from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/timeline';
import {PlaybookRun} from 'src/types/playbook_run';
import {Content, TabPageContainer, Title} from 'src/components/backstage/playbook_runs/shared';
import MultiCheckbox, {CheckboxOption} from 'src/components/multi_checkbox';
import {TimelineEvent, TimelineEventsFilter, TimelineEventType} from 'src/types/rhs';
import {setRHSEventsFilter} from 'src/actions';
import {rhsEventsFilterForChannel} from 'src/selectors';

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const FakeButton = styled.div`
    display: inline-flex;
    align-items: center;
    color: var(--button-bg);
    background: var(--button-color-rgb);
    border: 1px solid var(--button-bg);
    border-radius: 4px;
    padding: 0 20px;
    height: 32px;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.15s ease-out;
    margin-left: auto;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.12);
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

const TextContainer = styled.span`
    display: flex;
`;

type IdToUserFn = (userId: string) => UserProfile;

interface Props {
    playbookRun: PlaybookRun;
    deleteTimelineEvent: (id: string) => void;
}

const TimelineRetro = (props: Props) => {
    const dispatch = useDispatch();
    const displayPreference = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || 'username';
    const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
    const eventsFilter = useSelector<GlobalState, TimelineEventsFilter>((state) => rhsEventsFilterForChannel(state, props.playbookRun.channel_id));
    const getStateFn = useStore().getState;
    const getUserFn = (userId: string) => getUserAction(userId)(dispatch as DispatchFunc, getStateFn);
    const selectUser = useSelector<GlobalState, IdToUserFn>((state) => (userId: string) => getUser(state, userId));
    const {formatMessage} = useIntl();

    useEffect(() => {
        setFilteredEvents(allEvents.filter((e) => showEvent(e.event_type, eventsFilter)));
    }, [eventsFilter, allEvents]);

    useEffect(() => {
        const {
            status_posts: statuses,
            timeline_events: events,
        } = props.playbookRun;
        const statusDeleteAtByPostId = statuses.reduce<{[id: string]: number}>((map, post) => {
            if (post.delete_at !== 0) {
                map[post.id] = post.delete_at;
            }

            return map;
        }, {});
        Promise.all(events.map(async (event) => {
            let user = selectUser(event.subject_user_id) as UserProfile | undefined;

            if (!user) {
                const ret = await getUserFn(event.subject_user_id) as { data?: UserProfile, error?: any };
                if (!ret.data) {
                    return null;
                }
                user = ret.data;
            }
            return {
                ...event,
                status_delete_at: statusDeleteAtByPostId[event.post_id] ?? 0,
                subject_display_name: displayUsername(user, displayPreference),
            } as TimelineEvent;
        })).then((eventArray) => {
            setAllEvents(eventArray.filter((e) => e) as TimelineEvent[]);
        });
    }, [props.playbookRun.timeline_events, displayPreference, props.playbookRun.status_posts]);

    const selectOption = (value: string, checked: boolean) => {
        if (eventsFilter.all && value !== 'all') {
            return;
        }

        dispatch(setRHSEventsFilter(props.playbookRun.channel_id, {
            ...eventsFilter,
            [value]: checked,
        }));
    };

    const filterOptions = [
        {
            display: formatMessage({defaultMessage: 'All events'}),
            value: 'all',
            selected: eventsFilter.all,
            disabled: false,
        },
        {
            value: 'divider',
        } as CheckboxOption,
        {
            display: formatMessage({defaultMessage: 'Role changes'}),
            value: TimelineEventType.OwnerChanged,
            selected: eventsFilter.owner_changed,
            disabled: eventsFilter.all,
        },
        {
            display: formatMessage({defaultMessage: 'Status updates'}),
            value: TimelineEventType.StatusUpdated,
            selected: eventsFilter.status_updated,
            disabled: eventsFilter.all,
        },
        {
            display: formatMessage({defaultMessage: 'Saved messages'}),
            value: TimelineEventType.EventFromPost,
            selected: eventsFilter.event_from_post,
            disabled: eventsFilter.all,
        },
        {
            display: formatMessage({defaultMessage: 'Task state changes'}),
            value: TimelineEventType.TaskStateModified,
            selected: eventsFilter.task_state_modified,
            disabled: eventsFilter.all,
        },
        {
            display: formatMessage({defaultMessage: 'Task assignments'}),
            value: TimelineEventType.AssigneeChanged,
            selected: eventsFilter.assignee_changed,
            disabled: eventsFilter.all,
        },
        {
            display: formatMessage({defaultMessage: 'Slash commands'}),
            value: TimelineEventType.RanSlashCommand,
            selected: eventsFilter.ran_slash_command,
            disabled: eventsFilter.all,
        },
    ];

    return (
        <TabPageContainer>
            <Header>
                <Title>{formatMessage({defaultMessage: 'Timeline'})}</Title>
                <MultiCheckbox
                    dotMenuButton={FakeButton}
                    options={filterOptions}
                    onselect={selectOption}
                    placement='bottom-end'
                    icon={
                        <TextContainer>
                            <i className='icon icon-filter-variant'/>
                            {formatMessage({defaultMessage: 'Filter'})}
                        </TextContainer>
                    }
                />
                {/*
                    <PrimaryButtonNotRight>
                    <i className='icon-download-outline'/>
                    {'Export'}
                    </PrimaryButtonNotRight>
                */}
            </Header>
            <Content>
                <Timeline
                    playbookRun={props.playbookRun}
                    filteredEvents={filteredEvents}
                    deleteTimelineEvent={props.deleteTimelineEvent}
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
        (eventType === TimelineEventType.RunCreated && filterRecord[TimelineEventType.StatusUpdated]) ||
        (eventType === TimelineEventType.RunFinished && filterRecord[TimelineEventType.StatusUpdated]) ||
        (eventType === TimelineEventType.RunRestored && filterRecord[TimelineEventType.StatusUpdated]);
};
