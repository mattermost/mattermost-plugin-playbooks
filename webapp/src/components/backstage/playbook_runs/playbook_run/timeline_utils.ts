// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import {useIntl} from 'react-intl';

import {GlobalState} from 'mattermost-redux/types/store';
import {UserProfile} from 'mattermost-redux/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUser as getUserAction} from 'mattermost-redux/actions/users';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {TimelineEvent, TimelineEventsFilter, TimelineEventType} from 'src/types/rhs';
import {rhsEventsFilterForChannel} from 'src/selectors';
import {PlaybookRun} from 'src/types/playbook_run';
import {CheckboxOption} from 'src/components/multi_checkbox';
import {setRHSEventsFilter} from 'src/actions';

type IdToUserFn = (userId: string) => UserProfile;

export const useTimelineEvents = (playbookRun: PlaybookRun) => {
    const dispatch = useDispatch();
    const displayPreference = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || 'username';
    const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
    const eventsFilter = useSelector<GlobalState, TimelineEventsFilter>((state) => rhsEventsFilterForChannel(state, playbookRun.channel_id));
    const getStateFn = useStore().getState;
    const getUserFn = (userId: string) => getUserAction(userId)(dispatch as DispatchFunc, getStateFn);
    const selectUser = useSelector<GlobalState, IdToUserFn>((state) => (userId: string) => getUser(state, userId));

    useEffect(() => {
        setFilteredEvents(allEvents.filter((e) => showEvent(e.event_type, eventsFilter)));
    }, [eventsFilter, allEvents]);

    useEffect(() => {
        const {
            status_posts: statuses,
            timeline_events: events,
        } = playbookRun;

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
            eventArray.reverse();
            setAllEvents(eventArray.filter((e) => e) as TimelineEvent[]);
        });
    }, [playbookRun.timeline_events, displayPreference, playbookRun.status_posts]);

    return [filteredEvents];
};

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

export const useFilter = (playbookRun: PlaybookRun) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const eventsFilter = useSelector<GlobalState, TimelineEventsFilter>((state) => rhsEventsFilterForChannel(state, playbookRun.channel_id));

    const selectOption = (value: string, checked: boolean) => {
        if (eventsFilter.all && value !== 'all') {
            return;
        }

        dispatch(setRHSEventsFilter(playbookRun.channel_id, {
            ...eventsFilter,
            [value]: checked,
        }));
    };

    const options = [
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
    return {options, selectOption};
};
