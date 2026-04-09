// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import debounce from 'debounce';
import {DateTime} from 'luxon';
import React, {
    type HTMLAttributes,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {FormattedMessage, type IntlShape, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {GlobalState} from '@mattermost/types/store';
import {type UserProfile} from '@mattermost/types/users';
import {searchProfiles} from 'mattermost-redux/actions/users';
import {getUsers} from 'mattermost-redux/selectors/entities/common';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {pluginUrl} from 'src/browser_routing';
import {fetchPlaybookRuns, fetchPlaybookTimelineEvents} from 'src/client';
import SearchInput from 'src/components/backstage/search_input';
import {StyledSelect} from 'src/components/backstage/styles';
import {PaginationRow} from 'src/components/pagination_row';
import {SortableColHeader} from 'src/components/sortable_col_header';
import {useEnsureProfiles} from 'src/hooks';
import {
    FetchPlaybookTimelineEventsParams,
    PlaybookRun,
    PlaybookRunStatus,
    PlaybookTimelineEvent,
} from 'src/types/playbook_run';
import {
    type ParticipantsChangedDetails,
    type PropertyChangedDetails,
    type TaskStateModifiedDetails,
    TimelineEventType,
    type UserJoinedLeftDetails,
} from 'src/types/rhs';

const searchDebounceDelayMilliseconds = 300;
const autoRefreshIntervalOptionsSeconds = [5, 15, 30, 60];
const perPageOptions = [25, 50, 100];
const columnHelper = createColumnHelper<PlaybookTimelineEvent>();

const defaultFetchParams: FetchPlaybookTimelineEventsParams = {
    page: 0,
    per_page: 50,
    sort: 'event_at',
    direction: 'desc',
    statuses: [PlaybookRunStatus.InProgress, PlaybookRunStatus.Finished],
};

const eventTypeLabels: Record<TimelineEventType, string> = {
    [TimelineEventType.RunCreated]: 'Run started',
    [TimelineEventType.StatusUpdated]: 'Status updated',
    [TimelineEventType.StatusUpdateRequested]: 'Status update requested',
    [TimelineEventType.StatusUpdateSnoozed]: 'Status update snoozed',
    [TimelineEventType.OwnerChanged]: 'Owner changed',
    [TimelineEventType.AssigneeChanged]: 'Assignee changed',
    [TimelineEventType.TaskStateModified]: 'Task updated',
    [TimelineEventType.RanSlashCommand]: 'Slash command executed',
    [TimelineEventType.EventFromPost]: 'Added from post',
    [TimelineEventType.UserJoinedLeft]: 'Participant changed',
    [TimelineEventType.ParticipantsChanged]: 'Participants changed',
    [TimelineEventType.PublishedRetrospective]: 'Retrospective published',
    [TimelineEventType.CanceledRetrospective]: 'Retrospective canceled',
    [TimelineEventType.RunFinished]: 'Run finished',
    [TimelineEventType.RunRestored]: 'Run restored',
    [TimelineEventType.StatusUpdatesEnabled]: 'Status updates enabled',
    [TimelineEventType.StatusUpdatesDisabled]: 'Status updates disabled',
    [TimelineEventType.PropertyChanged]: 'Attribute changed',
};

const eventTypeOptions = Object.entries(eventTypeLabels).map(([value, label]) => ({
    value,
    label,
}));

interface Props {
    playbookID: string;
}

type Attrs = HTMLAttributes<HTMLElement>;

type SelectOption = {
    value: string;
    label: string;
};

const PlaybookEvents = ({playbookID, ...attrs}: Props & Attrs) => {
    const intl = useIntl();
    const {formatMessage} = intl;
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const nameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) ?? '';
    const usersMap = useSelector(getUsers);

    const [events, setEvents] = useState<PlaybookTimelineEvent[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [fetchParams, setFetchParams] = useState<FetchPlaybookTimelineEventsParams>(defaultFetchParams);
    const [selectedEventTypeOptions, setSelectedEventTypeOptions] = useState<SelectOption[]>([]);
    const [selectedRunOptions, setSelectedRunOptions] = useState<SelectOption[]>([]);
    const [runOptions, setRunOptions] = useState<SelectOption[]>([]);
    const [runSearchTerm, setRunSearchTerm] = useState('');
    const [selectedUserOptions, setSelectedUserOptions] = useState<SelectOption[]>([]);
    const [userOptions, setUserOptions] = useState<SelectOption[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [autoRefreshIntervalSeconds, setAutoRefreshIntervalSeconds] = useState(autoRefreshIntervalOptionsSeconds[0]);
    const [, setBackgroundRefreshing] = useState(false);
    const [isPageVisible, setIsPageVisible] = useState(() => document.visibilityState === 'visible');
    const latestRequestIDRef = useRef(0);

    const fetchEvents = useCallback(async (background = false) => {
        const requestID = latestRequestIDRef.current + 1;
        latestRequestIDRef.current = requestID;

        if (background) {
            setBackgroundRefreshing(true);
        } else {
            setLoading(true);
            setBackgroundRefreshing(false);
        }

        try {
            const result = await fetchPlaybookTimelineEvents(playbookID, {...fetchParams, team_id: currentTeamId});
            if (latestRequestIDRef.current !== requestID) {
                return;
            }

            setEvents(result.items);
            setTotalCount(result.total_count);
        } catch {
            if (latestRequestIDRef.current !== requestID) {
                return;
            }

            if (!background) {
                setEvents([]);
                setTotalCount(0);
            }
        } finally {
            if (background && latestRequestIDRef.current === requestID) {
                setBackgroundRefreshing(false);
            }

            if (!background && latestRequestIDRef.current === requestID) {
                setLoading(false);
            }
        }
    }, [currentTeamId, fetchParams, playbookID]);

    useEffect(() => {
        fetchEvents(false);
    }, [fetchEvents]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsPageVisible(document.visibilityState === 'visible');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const autoRefreshEnabled = isPageVisible &&
        fetchParams.page === 0 &&
        fetchParams.sort === 'event_at' &&
        (fetchParams.direction ?? 'desc') === 'desc';

    useEffect(() => {
        if (!autoRefreshEnabled) {
            setBackgroundRefreshing(false);
            return undefined;
        }

        const intervalID = setInterval(() => {
            fetchEvents(true);
        }, autoRefreshIntervalSeconds * 1000);

        return () => {
            clearInterval(intervalID);
        };
    }, [autoRefreshEnabled, autoRefreshIntervalSeconds, fetchEvents]);

    useEffect(() => {
        let cancelled = false;
        const timeout = setTimeout(async () => {
            try {
                const result = await fetchPlaybookRuns({
                    page: 0,
                    per_page: 50,
                    team_id: currentTeamId,
                    playbook_id: playbookID,
                    search_term: runSearchTerm || undefined,
                    statuses: [PlaybookRunStatus.InProgress, PlaybookRunStatus.Finished],
                });

                if (cancelled) {
                    return;
                }

                const options = result.items.map(buildRunOption);
                setRunOptions(mergeOptions(selectedRunOptions, options));
            } catch {
                if (!cancelled) {
                    setRunOptions(selectedRunOptions);
                }
            }
        }, searchDebounceDelayMilliseconds);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [currentTeamId, playbookID, runSearchTerm, selectedRunOptions]);

    useEffect(() => {
        let cancelled = false;
        const timeout = setTimeout(async () => {
            try {
                const result = await dispatch(searchProfiles(userSearchTerm, {team_id: currentTeamId})) as unknown as {data: UserProfile[]};

                if (cancelled) {
                    return;
                }

                const options = result.data.map((profile) => buildUserOption(profile, nameDisplaySetting));
                setUserOptions(mergeOptions(selectedUserOptions, options));
            } catch {
                if (!cancelled) {
                    setUserOptions(selectedUserOptions);
                }
            }
        }, searchDebounceDelayMilliseconds);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [currentTeamId, dispatch, nameDisplaySetting, selectedUserOptions, userSearchTerm]);

    const userIDsToEnsure = useMemo(() => {
        const userIDs = new Set<string>();
        for (const event of events) {
            if (event.subject_user_id) {
                userIDs.add(event.subject_user_id);
            }
            if (event.creator_user_id) {
                userIDs.add(event.creator_user_id);
            }
        }
        return [...userIDs];
    }, [events]);

    useEnsureProfiles(userIDsToEnsure);

    const onSearch = useMemo(
        () => debounce((term: string) => setFetchParams((prev) => ({...prev, search_term: term, page: 0})), searchDebounceDelayMilliseconds),
        [],
    );

    const setPage = (page: number) => {
        setFetchParams((prev) => ({...prev, page}));
    };

    const setSort = (sort: string) => {
        setFetchParams((prev) => {
            if (prev.sort === sort) {
                return {
                    ...prev,
                    direction: prev.direction === 'asc' ? 'desc' : 'asc',
                    page: 0,
                };
            }

            return {
                ...prev,
                sort,
                direction: sort === 'event_at' ? 'desc' : 'asc',
                page: 0,
            };
        });
    };

    const columns = useMemo(() => [
        columnHelper.accessor('event_at', {
            id: 'event_at',
            header: () => (
                <SortableColHeader
                    name={formatMessage({defaultMessage: 'Time'})}
                    direction={fetchParams.direction ?? 'desc'}
                    active={fetchParams.sort === 'event_at'}
                    onClick={() => setSort('event_at')}
                />
            ),
            cell: (info) => DateTime.fromMillis(info.getValue()).toLocaleString(DateTime.DATETIME_MED),
        }),
        columnHelper.accessor('playbook_run_name', {
            id: 'playbook_run_name',
            header: () => (
                <SortableColHeader
                    name={formatMessage({defaultMessage: 'Run'})}
                    direction={fetchParams.direction ?? 'asc'}
                    active={fetchParams.sort === 'name'}
                    onClick={() => setSort('name')}
                />
            ),
            cell: (info) => (
                <RunNameCell>
                    <RunLink
                        to={pluginUrl(`/runs/${info.row.original.playbook_run_id}`)}
                        title={info.getValue()}
                    >
                        <RunMeta>
                            <RunIDBadge>{info.row.original.sequential_id || String.fromCharCode(45)}</RunIDBadge>
                            <RunNameText>{info.getValue()}</RunNameText>
                        </RunMeta>
                    </RunLink>
                </RunNameCell>
            ),
        }),
        columnHelper.accessor('event_type', {
            id: 'event_type',
            header: () => (
                <SortableColHeader
                    name={formatMessage({defaultMessage: 'Event'})}
                    direction={fetchParams.direction ?? 'asc'}
                    active={fetchParams.sort === 'event_type'}
                    onClick={() => setSort('event_type')}
                />
            ),
            cell: (info) => {
                const event = info.row.original;
                const formattedEvent = formatTimelineEvent(event, intl, usersMap, nameDisplaySetting);
                return (
                    <EventCellContent>
                        <EventTitleRow>
                            <EventIconContainer>
                                <i className={formattedEvent.icon}/>
                            </EventIconContainer>
                            <EventTitle>{formattedEvent.title}</EventTitle>
                        </EventTitleRow>
                        {formattedEvent.summary && (
                            <EventSummary>{formattedEvent.summary}</EventSummary>
                        )}
                    </EventCellContent>
                );
            },
        }),
    ], [fetchParams.direction, fetchParams.sort, formatMessage, intl, nameDisplaySetting, usersMap]);

    const table = useReactTable({
        data: events,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const hasFilters = Boolean(fetchParams.search_term) || Boolean(fetchParams.event_types?.length) || Boolean(fetchParams.run_ids?.length) || Boolean(fetchParams.user_ids?.length);

    return (
        <OuterContainer {...attrs}>
            <InnerContainer>
                <HeaderPanel>
                    <PrimaryFiltersRow>
                        <FilterField>
                            <FilterLabel htmlFor='playbook-events-search'>
                                <FormattedMessage defaultMessage='Search'/>
                            </FilterLabel>
                            <SearchInput
                                testId='playbook-events-search'
                                default={fetchParams.search_term}
                                onSearch={onSearch}
                                placeholder={formatMessage({defaultMessage: 'Search events'})}
                                width='100%'
                            />
                        </FilterField>
                        <FilterField>
                            <FilterLabel>
                                <FormattedMessage defaultMessage='Event types'/>
                            </FilterLabel>
                            <StyledSelect
                                isMulti={true}
                                closeMenuOnSelect={false}
                                hideSelectedOptions={false}
                                isClearable={true}
                                options={eventTypeOptions}
                                value={selectedEventTypeOptions}
                                placeholder={formatMessage({defaultMessage: 'Filter event types'})}
                                onChange={(options: SelectOption[]) => {
                                    const nextOptions = options || [];
                                    setSelectedEventTypeOptions(nextOptions);
                                    setFetchParams((prev) => ({
                                        ...prev,
                                        event_types: nextOptions.length ? nextOptions.map((option) => option.value) : undefined,
                                        page: 0,
                                    }));
                                }}
                            />
                        </FilterField>
                        <FilterField>
                            <FilterLabel>
                                <FormattedMessage defaultMessage='Runs'/>
                            </FilterLabel>
                            <StyledSelect
                                isMulti={true}
                                closeMenuOnSelect={false}
                                hideSelectedOptions={false}
                                isClearable={true}
                                options={mergeOptions(selectedRunOptions, runOptions)}
                                value={selectedRunOptions}
                                placeholder={formatMessage({defaultMessage: 'Filter runs'})}
                                noOptionsMessage={() => formatMessage({defaultMessage: 'No runs found'})}
                                filterOption={() => true}
                                onInputChange={(value: string, meta: {action: string}) => {
                                    if (meta.action === 'input-change') {
                                        setRunSearchTerm(value);
                                    }
                                    return value;
                                }}
                                onChange={(options: SelectOption[]) => {
                                    const nextOptions = options || [];
                                    setSelectedRunOptions(nextOptions);
                                    setRunOptions((prev) => mergeOptions(nextOptions, prev));
                                    setFetchParams((prev) => ({
                                        ...prev,
                                        run_ids: nextOptions.length ? nextOptions.map((option) => option.value) : undefined,
                                        page: 0,
                                    }));
                                }}
                            />
                        </FilterField>
                        <FilterField>
                            <FilterLabel>
                                <FormattedMessage defaultMessage='Users'/>
                            </FilterLabel>
                            <StyledSelect
                                isMulti={true}
                                closeMenuOnSelect={false}
                                hideSelectedOptions={false}
                                isClearable={true}
                                options={mergeOptions(selectedUserOptions, userOptions)}
                                value={selectedUserOptions}
                                placeholder={formatMessage({defaultMessage: 'Filter actors or targets'})}
                                noOptionsMessage={() => formatMessage({defaultMessage: 'No users found'})}
                                filterOption={() => true}
                                onInputChange={(value: string, meta: {action: string}) => {
                                    if (meta.action === 'input-change') {
                                        setUserSearchTerm(value);
                                    }
                                    return value;
                                }}
                                onChange={(options: SelectOption[]) => {
                                    const nextOptions = options || [];
                                    setSelectedUserOptions(nextOptions);
                                    setUserOptions((prev) => mergeOptions(nextOptions, prev));
                                    setFetchParams((prev) => ({
                                        ...prev,
                                        user_ids: nextOptions.length ? nextOptions.map((option) => option.value) : undefined,
                                        page: 0,
                                    }));
                                }}
                            />
                        </FilterField>
                    </PrimaryFiltersRow>
                    <SecondaryFiltersRow>
                        <RowsPerPageField>
                            <FilterLabel htmlFor='playbook-events-per-page'>
                                <FormattedMessage defaultMessage='Rows per page'/>
                            </FilterLabel>
                            <PerPageSelect
                                id='playbook-events-per-page'
                                value={fetchParams.per_page}
                                onChange={(e) => {
                                    const perPage = Number(e.target.value);
                                    setFetchParams((prev) => ({
                                        ...prev,
                                        per_page: perPage,
                                        page: 0,
                                    }));
                                }}
                            >
                                {perPageOptions.map((option) => (
                                    <option
                                        key={option}
                                        value={option}
                                    >
                                        {option}
                                    </option>
                                ))}
                            </PerPageSelect>
                        </RowsPerPageField>
                        <RowsPerPageField>
                            <FilterLabel htmlFor='playbook-events-update-interval'>
                                <FormattedMessage defaultMessage='Update interval'/>
                            </FilterLabel>
                            <PerPageSelect
                                id='playbook-events-update-interval'
                                value={autoRefreshIntervalSeconds}
                                onChange={(e) => {
                                    setAutoRefreshIntervalSeconds(Number(e.target.value));
                                }}
                            >
                                {autoRefreshIntervalOptionsSeconds.map((option) => (
                                    <option
                                        key={option}
                                        value={option}
                                    >
                                        {formatMessage({defaultMessage: '{seconds} seconds'}, {seconds: option})}
                                    </option>
                                ))}
                            </PerPageSelect>
                        </RowsPerPageField>
                    </SecondaryFiltersRow>
                </HeaderPanel>
                <TableWrapper>
                    <EventsTable>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <HeaderCell key={header.id}>
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </HeaderCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {loading && (
                                <TableRow>
                                    <LoadingCell colSpan={table.getVisibleLeafColumns().length}>
                                        <FormattedMessage defaultMessage='Loading…'/>
                                    </LoadingCell>
                                </TableRow>
                            )}
                            {!loading && table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <Cell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </Cell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </EventsTable>
                    {!loading && events.length === 0 && (
                        <EmptyState>
                            {hasFilters ? (
                                <FormattedMessage defaultMessage='There are no events matching those filters.'/>
                            ) : (
                                <FormattedMessage defaultMessage='There are no events for this playbook yet.'/>
                            )}
                        </EmptyState>
                    )}
                </TableWrapper>
                <PaginationRow
                    page={fetchParams.page}
                    perPage={fetchParams.per_page}
                    totalCount={totalCount}
                    setPage={setPage}
                />
            </InnerContainer>
        </OuterContainer>
    );
};

function buildRunOption(run: PlaybookRun): SelectOption {
    const runID = run.sequential_id || '-';
    return {
        value: run.id,
        label: `${runID} ${run.name}`,
    };
}

function buildUserOption(profile: UserProfile, nameDisplaySetting: string): SelectOption {
    const displayName = displayUsername(profile, nameDisplaySetting);
    return {
        value: profile.id,
        label: displayName ? `${displayName} (${profile.username})` : profile.username,
    };
}

function mergeOptions(primary: SelectOption[], secondary: SelectOption[]) {
    const merged = new Map<string, SelectOption>();
    for (const option of [...primary, ...secondary]) {
        merged.set(option.value, option);
    }
    return [...merged.values()];
}

function formatTimelineEvent(
    event: PlaybookTimelineEvent,
    intl: IntlShape,
    usersMap: ReturnType<typeof getUsers>,
    nameDisplaySetting: string,
) {
    const parsedDetails = parseEventDetails(event.details);
    const title = getTimelineEventTitle(event, parsedDetails, intl, usersMap, nameDisplaySetting);
    const summary = getTimelineEventSummary(event, parsedDetails, intl, usersMap, nameDisplaySetting);

    return {
        title: ensureSentenceCase(title || eventTypeLabels[event.event_type] || event.event_type),
        summary: summary || '',
        icon: getTimelineEventIcon(event),
    };
}

function parseEventDetails(details: string) {
    try {
        return JSON.parse(details);
    } catch {
        return details;
    }
}

function getTimelineEventSummary(
    event: PlaybookTimelineEvent,
    parsedDetails: unknown,
    intl: IntlShape,
    usersMap: ReturnType<typeof getUsers>,
    nameDisplaySetting: string,
) {
    switch (event.event_type) {
    case TimelineEventType.AssigneeChanged:
    case TimelineEventType.RanSlashCommand:
        return [getEventActorDisplayName(event, usersMap, nameDisplaySetting), sanitizeEventText(event.summary)].filter(Boolean).join(' ');
    case TimelineEventType.UserJoinedLeft:
        return sanitizeEventText(event.summary);
    case TimelineEventType.ParticipantsChanged: {
        const details = parsedDetails as ParticipantsChangedDetails;
        if (details.action === 'joined') {
            return intl.formatMessage({defaultMessage: '{requester} added {users} to the run'}, {
                users: intl.formatList(details.users.map((u: string) => `@${u}`), {type: 'conjunction'}),
                requester: details.requester,
            });
        }
        return intl.formatMessage({defaultMessage: '{requester} removed {users} from the run'}, {
            users: intl.formatList(details.users.map((u: string) => `@${u}`), {type: 'conjunction'}),
            requester: details.requester,
        });
    }
    default:
        return '';
    }
}

function getTimelineEventTitle(
    event: PlaybookTimelineEvent,
    parsedDetails: unknown,
    intl: IntlShape,
    usersMap: ReturnType<typeof getUsers>,
    nameDisplaySetting: string,
) {
    const actor = getEventActorDisplayName(event, usersMap, nameDisplaySetting);
    switch (event.event_type) {
    case TimelineEventType.RunCreated:
        return actor ? intl.formatMessage({defaultMessage: 'Run started by {name}'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Run started'});
    case TimelineEventType.RunFinished:
        return actor ? intl.formatMessage({defaultMessage: 'Run finished by {name}'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Run finished'});
    case TimelineEventType.RunRestored:
        return actor ? intl.formatMessage({defaultMessage: 'Run restored by {name}'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Run restored'});
    case TimelineEventType.StatusUpdated:
        if (event.summary === '') {
            return actor ? intl.formatMessage({defaultMessage: '{name} posted a status update'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Posted a status update'});
        }
        return actor ? intl.formatMessage({defaultMessage: '{name} changed status from {summary}'}, {
            name: actor,
            summary: sanitizeEventText(event.summary),
        }) : intl.formatMessage({defaultMessage: 'Changed status from {summary}'}, {summary: sanitizeEventText(event.summary)});
    case TimelineEventType.StatusUpdateSnoozed:
        return actor ? intl.formatMessage({defaultMessage: '{name} snoozed a status update'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Snoozed a status update'});
    case TimelineEventType.StatusUpdateRequested:
        return actor ? intl.formatMessage({defaultMessage: '{name} requested a status update'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Requested a status update'});
    case TimelineEventType.OwnerChanged:
        return actor ? intl.formatMessage({defaultMessage: '{name} changed owner from {summary}'}, {name: actor, summary: sanitizeEventText(event.summary)}) : intl.formatMessage({defaultMessage: 'Owner changed from {summary}'}, {summary: sanitizeEventText(event.summary)});
    case TimelineEventType.TaskStateModified: {
        const user = actor || intl.formatMessage({defaultMessage: 'Someone'});
        const {action, task: name} = parsedDetails as TaskStateModifiedDetails;

        switch (action) {
        case 'check':
            return intl.formatMessage({defaultMessage: '{user} checked off checklist item "{name}"'}, {user, name});
        case 'uncheck':
            return intl.formatMessage({defaultMessage: '{user} unchecked checklist item "{name}"'}, {user, name});
        case 'skip':
            return intl.formatMessage({defaultMessage: '{user} skipped checklist item "{name}"'}, {user, name});
        case 'restore':
            return intl.formatMessage({defaultMessage: '{user} restored checklist item "{name}"'}, {user, name});
        default:
            return sanitizeEventText(actor ? `${actor} ${event.summary}` : event.summary);
        }
    }
    case TimelineEventType.AssigneeChanged:
        return intl.formatMessage({defaultMessage: 'Assignee changed'});
    case TimelineEventType.RanSlashCommand:
        return intl.formatMessage({defaultMessage: 'Slash command executed'});
    case TimelineEventType.EventFromPost:
        return sanitizeEventText(event.summary);
    case TimelineEventType.UserJoinedLeft: {
        const details = parsedDetails as UserJoinedLeftDetails;
        if (details.title) {
            return details.title;
        }
        if (details.action === 'joined') {
            return intl.formatMessage({defaultMessage: '@{user} joined the run'}, {user: details.users[0]});
        }
        return intl.formatMessage({defaultMessage: '@{user} left the run'}, {user: details.users[0]});
    }
    case TimelineEventType.ParticipantsChanged: {
        const details = parsedDetails as ParticipantsChangedDetails;
        if (details.users.length > 1) {
            if (details.action === 'joined') {
                return intl.formatMessage({defaultMessage: '{name} added {num} participants to the run'}, {name: details.requester, num: details.users.length});
            }
            return intl.formatMessage({defaultMessage: '{name} removed {num} participants from the run'}, {name: details.requester, num: details.users.length});
        }
        if (details.action === 'joined') {
            return intl.formatMessage({defaultMessage: '{name} added @{user} to the run'}, {name: details.requester, user: details.users[0]});
        }
        return intl.formatMessage({defaultMessage: '{name} removed @{user} from the run'}, {name: details.requester, user: details.users[0]});
    }
    case TimelineEventType.PublishedRetrospective:
        return actor ? intl.formatMessage({defaultMessage: 'Retrospective published by {name}'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Retrospective published'});
    case TimelineEventType.CanceledRetrospective:
        return actor ? intl.formatMessage({defaultMessage: 'Retrospective canceled by {name}'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Retrospective canceled'});
    case TimelineEventType.StatusUpdatesEnabled:
        return actor ? intl.formatMessage({defaultMessage: 'Run status updates enabled by {name}'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Run status updates enabled'});
    case TimelineEventType.StatusUpdatesDisabled:
        return actor ? intl.formatMessage({defaultMessage: 'Run status updates disabled by {name}'}, {name: actor}) : intl.formatMessage({defaultMessage: 'Run status updates disabled'});
    case TimelineEventType.PropertyChanged: {
        const details = parsedDetails as PropertyChangedDetails;
        const oldValue = details.old_value_display ?? stringifyPropertyChangeValue(details.old_value);
        const newValue = details.new_value_display ?? stringifyPropertyChangeValue(details.new_value);
        if (details.old_value_display === null && details.new_value_display !== null) {
            return actor ? intl.formatMessage({defaultMessage: '{name} set {property} to {value}'}, {
                name: actor,
                property: details.property_field_name,
                value: newValue,
            }) : intl.formatMessage({defaultMessage: 'Set {property} to {value}'}, {property: details.property_field_name, value: newValue});
        }
        if (details.new_value_display === null) {
            return actor ? intl.formatMessage({defaultMessage: '{name} cleared {property}'}, {
                name: actor,
                property: details.property_field_name,
            }) : intl.formatMessage({defaultMessage: 'Cleared {property}'}, {property: details.property_field_name});
        }
        return actor ? intl.formatMessage({defaultMessage: '{name} updated {property} from {oldValue} to {newValue}'}, {
            name: actor,
            property: details.property_field_name,
            oldValue,
            newValue,
        }) : intl.formatMessage({defaultMessage: 'Updated {property} from {oldValue} to {newValue}'}, {property: details.property_field_name, oldValue, newValue});
    }
    default:
        return sanitizeEventText(event.summary || event.details);
    }
}

function sanitizeEventText(value: string) {
    return value.replace(/\*\*/g, '"').trim();
}

function ensureSentenceCase(value: string) {
    return value.replace(/^[a-z]/, (match) => match.toUpperCase());
}

function getEventActorDisplayName(
    event: PlaybookTimelineEvent,
    usersMap: ReturnType<typeof getUsers>,
    nameDisplaySetting: string,
) {
    if (event.subject_display_name) {
        return event.subject_display_name;
    }

    const subjectUser = usersMap[event.subject_user_id];
    if (subjectUser) {
        return displayUsername(subjectUser, nameDisplaySetting);
    }

    const creatorUser = usersMap[event.creator_user_id];
    if (creatorUser) {
        return displayUsername(creatorUser, nameDisplaySetting);
    }

    return '';
}

function getTimelineEventIcon(event: PlaybookTimelineEvent) {
    switch (event.event_type) {
    case TimelineEventType.RunCreated:
    case TimelineEventType.RunFinished:
    case TimelineEventType.RunRestored:
        return 'icon-shield-alert-outline';
    case TimelineEventType.StatusUpdated:
    case TimelineEventType.StatusUpdateSnoozed:
        return 'icon-flag-outline';
    case TimelineEventType.StatusUpdateRequested:
        return 'icon-update';
    case TimelineEventType.TaskStateModified:
        return 'icon-format-list-bulleted';
    case TimelineEventType.OwnerChanged:
    case TimelineEventType.AssigneeChanged:
    case TimelineEventType.RanSlashCommand:
    case TimelineEventType.PublishedRetrospective:
    case TimelineEventType.EventFromPost:
    case TimelineEventType.PropertyChanged:
        return 'icon-pencil-outline';
    case TimelineEventType.UserJoinedLeft:
    case TimelineEventType.ParticipantsChanged:
        return 'icon-account-outline';
    case TimelineEventType.CanceledRetrospective:
        return 'icon-cancel';
    case TimelineEventType.StatusUpdatesEnabled:
    case TimelineEventType.StatusUpdatesDisabled:
        return 'icon-clock-outline';
    default:
        return 'icon-pencil-outline';
    }
}

function stringifyPropertyChangeValue(value: string | string[]) {
    return Array.isArray(value) ? value.join(', ') : value;
}

const OuterContainer = styled.div`
    height: 100%;
`;

const InnerContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 20px;
    margin: 0 auto;

    > * + * {
        margin-top: 12px;
    }
`;

const HeaderPanel = styled.div`
    padding: 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    background: rgba(var(--center-channel-color-rgb), 0.02);
`;

const PrimaryFiltersRow = styled.div`
    display: grid;
    align-items: start;
    gap: 12px 16px;
    grid-template-columns: minmax(220px, 0.95fr) minmax(240px, 1fr) minmax(280px, 1.2fr) minmax(240px, 1fr);

    @media screen and (max-width: 1200px) {
        grid-template-columns: repeat(2, minmax(260px, 1fr));
    }

    @media screen and (max-width: 900px) {
        grid-template-columns: 1fr;
    }
`;

const SecondaryFiltersRow = styled.div`
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    margin-top: 12px;
    gap: 12px;

    @media screen and (max-width: 900px) {
        justify-content: flex-start;
    }
`;

const FilterField = styled.div`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;
`;

const FilterLabel = styled.label`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    font-weight: 600;
`;

const RowsPerPageField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 110px;
`;

const PerPageSelect = styled.select`
    width: 110px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 12px;
`;

const TableWrapper = styled.div`
    overflow-x: auto;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    background: var(--center-channel-bg);
`;

const EventsTable = styled.table`
    width: 100%;
    border-collapse: collapse;
`;

const TableHeader = styled.thead`
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    background: rgba(var(--center-channel-color-rgb), 0.04);
`;

const TableBody = styled.tbody``;

const HeaderCell = styled.th`
    padding: 12px 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    vertical-align: top;
`;

const TableRow = styled.tr`
    &:not(:last-child) {
        border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const Cell = styled.td`
    padding: 12px 16px;
    color: var(--center-channel-color);
    font-size: 13px;
    vertical-align: top;
    white-space: nowrap;
`;

const RunNameCell = styled.div`
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const RunMeta = styled.div`
    display: inline-flex;
    max-width: 100%;
    align-items: center;
    gap: 8px;
`;

const RunIDBadge = styled.span`
    display: inline-flex;
    height: 20px;
    align-items: center;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.8);
    font-size: 11px;
    font-weight: 600;
    line-height: 20px;
    flex: 0 0 auto;
`;

const RunNameText = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const EventCellContent = styled.div`
    min-width: 320px;
    white-space: normal;
`;

const EventTitleRow = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 8px;
`;

const EventIconContainer = styled.div`
    display: inline-flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: var(--button-bg);
    flex: 0 0 24px;

    i {
        font-size: 14px;
        line-height: 1;
    }
`;

const EventTitle = styled.div`
    font-weight: 600;
    line-height: 20px;
`;

const EventSummary = styled.div`
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const RunLink = styled(Link)`
    color: var(--button-bg);

    &:hover {
        text-decoration: underline;
    }
`;

const LoadingCell = styled.td`
    padding: 24px 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    text-align: center;
`;

const EmptyState = styled.div`
    padding: 32px 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    text-align: center;
`;

export default styled(PlaybookEvents)`/* stylelint-disable no-empty-source */`;
