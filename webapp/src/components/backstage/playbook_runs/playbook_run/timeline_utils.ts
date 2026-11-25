// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';

import {useIntl} from 'react-intl';

import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUser as getUserAction} from 'mattermost-redux/actions/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {useAppDispatch, useAppSelector} from 'src/hooks/redux';

import {
    TimelineEvent,
    TimelineEventType,
    TimelineEventsFilter,
    TimelineEventsFilterDefault,
    isPhaseEventType,
} from 'src/types/rhs';
import {PlaybookRun} from 'src/types/playbook_run';
import {CheckboxOption} from 'src/components/multi_checkbox';

// How long each phase took, by the id of its phase_done event: from the first time the phase
// started until it was done.
export const phaseDurations = (events: TimelineEvent[]): Record<string, number> => {
    const phaseOf = (event: TimelineEvent): string | undefined => {
        try {
            return (JSON.parse(event.details) as {checklist_id?: string}).checklist_id;
        } catch {
            return undefined;
        }
    };

    const firstStart: Record<string, number> = {};
    for (const event of events) {
        const checklistId = phaseOf(event);
        if (event.delete_at === 0 && event.event_type === TimelineEventType.PhaseStarted && checklistId) {
            firstStart[checklistId] = Math.min(firstStart[checklistId] ?? event.event_at, event.event_at);
        }
    }

    const durations: Record<string, number> = {};
    for (const event of events) {
        const checklistId = phaseOf(event);
        if (event.event_type !== TimelineEventType.PhaseDone || !checklistId || firstStart[checklistId] === undefined) {
            continue;
        }
        const duration = event.event_at - firstStart[checklistId];
        if (duration > 0) {
            durations[event.id] = duration;
        }
    }
    return durations;
};

export const useTimelineEvents = (playbookRun: PlaybookRun, eventsFilter: TimelineEventsFilter) => {
    const dispatch = useAppDispatch();
    const displayPreference = useAppSelector(getTeammateNameDisplaySetting) || 'username';
    const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
    const getUserFn = (userId: string) => dispatch(getUserAction(userId));
    const selectUser = useAppSelector((state) => (userId: string) => getUser(state, userId));

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

        const durations = phaseDurations(events);

        Promise.all(events.map(async (event) => {
            // Phase moves the tasks caused have no person behind them.
            if (!event.subject_user_id) {
                return {...event, status_delete_at: 0, subject_display_name: '', phase_duration: durations[event.id]} as TimelineEvent;
            }

            let user = selectUser(event.subject_user_id);

            if (!user) {
                const ret = await getUserFn(event.subject_user_id);
                if (!ret.data) {
                    return null;
                }
                user = ret.data;
            }
            return {
                ...event,
                status_delete_at: statusDeleteAtByPostId[event.post_id] ?? 0,
                subject_display_name: displayUsername(user, displayPreference),
                phase_duration: durations[event.id],
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
    const statusUpdateTypes = [
        TimelineEventType.StatusUpdateRequested,
        TimelineEventType.RunCreated,
        TimelineEventType.RunFinished,
        TimelineEventType.RunRestored,
    ];
    if (isPhaseEventType(eventType)) {
        return filterRecord[TimelineEventType.PhaseStarted];
    }
    return filterRecord[eventType] || (filterRecord[TimelineEventType.StatusUpdated] && statusUpdateTypes.includes(eventType as TimelineEventType));
};

export const useFilter = () => {
    const {formatMessage} = useIntl();
    const [eventsFilter, setEventsFilter] = useState<TimelineEventsFilter>(TimelineEventsFilterDefault);

    const resetFilters = () => setEventsFilter(TimelineEventsFilterDefault);

    const selectOption = (value: string, checked: boolean) => {
        if (eventsFilter.all && value !== 'all') {
            return;
        }
        setEventsFilter({
            ...eventsFilter,
            [value]: checked,
        });
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
            display: formatMessage({defaultMessage: 'Phase changes'}),
            value: TimelineEventType.PhaseStarted,
            selected: eventsFilter.phase_started,
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
    return {options, selectOption, eventsFilter, resetFilters};
};
