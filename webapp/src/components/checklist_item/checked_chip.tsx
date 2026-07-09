// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';
import {
    CheckIcon,
    CheckboxBlankOutlineIcon,
    CloseIcon,
    RefreshIcon,
} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import Profile from 'src/components/profile/profile';
import {PAST_TIME_SPEC} from 'src/components/time_spec';
import {useFormattedUsernameByID} from 'src/hooks';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {TaskStateModifiedDetails, TimelineEvent, TimelineEventType} from 'src/types/rhs';
import {Timestamp} from 'src/webapp_globals';

type StateAction = 'check' | 'uncheck' | 'skip' | 'restore';

interface Props {
    item: ChecklistItem;

    // Run timeline events, passed down from the run that holds them via useRun. Read from props —
    // not the Redux store — because the single-run fetch (useRun/useThing) keeps the run in local
    // component state and does not hydrate the store, so a store selector here is unreliable.
    timelineEvents?: TimelineEvent[];

    // compact renders "✓ 5d"; otherwise "Checked 5 days ago" (parallels the "Due ..." chip).
    compact?: boolean;
}

const ICON_FOR_ACTION: Record<StateAction, typeof CheckIcon> = {
    check: CheckIcon,
    uncheck: CheckboxBlankOutlineIcon,
    skip: CloseIcon,
    restore: RefreshIcon,
};

// The item's resting state bounds which actions could have produced it. Only Open is ambiguous
// (unchecked vs. restored-from-skip) — the timeline event, when matched, tells them apart; with no
// event we default to the first (uncheck). Never-touched items (state_modified === 0) show nothing.
const actionsForState = (state: ChecklistItem['state']): StateAction[] => {
    switch (state) {
    case ChecklistItemState.Closed:
        return ['check'];
    case ChecklistItemState.Skip:
        return ['skip'];
    case ChecklistItemState.Open:
        return ['uncheck', 'restore'];
    default:
        return [];
    }
};

/**
 * CheckedChip shows when a checklist item last changed state — checked, unchecked, skipped, or
 * restored — and (best-effort) who did it.
 *
 * The "when" comes purely from the item JSON (`state_modified`) and is always reliable. The precise
 * verb and the "who" are resolved from the run timeline events — see {@link useStateEvent} — and
 * degrade gracefully (default verb, no avatar) whenever a confident match can't be made.
 */
const CheckedChip = ({item, timelineEvents, compact = false}: Props) => {
    const candidateActions = actionsForState(item.state);
    const show = candidateActions.length > 0 && item.state_modified > 0;

    const stateEvent = useStateEvent(timelineEvents, item, show, candidateActions);
    const subjectUserId = stateEvent?.subject_user_id ?? '';
    const subjectName = useFormattedUsernameByID(subjectUserId);

    if (!show) {
        return null;
    }

    const action = parseAction(stateEvent?.details) ?? candidateActions[0];
    const value = new Date(item.state_modified);

    const relative = (
        <Timestamp
            value={value}
            units={PAST_TIME_SPEC}
            useTime={false}
        />
    );

    // Full, fixed timestamp for the tooltip, e.g. "Jun 17, 2026 at 2:30 PM". Rendered via the
    // connected Timestamp so the time respects the user's 12/24-hour clock display preference.
    const absolute = (
        <Timestamp
            value={value}
            useRelative={false}
            useDate={{year: 'numeric', month: 'short', day: 'numeric'}}
        />
    );

    let label;
    if (compact) {
        const Icon = ICON_FOR_ACTION[action];
        label = (
            <>
                <Icon size={14}/>
                <Timestamp
                    value={value}
                    units={PAST_TIME_SPEC}
                    useTime={false}
                    style='narrow'
                />
            </>
        );
    } else {
        label = chipLabel(action, relative);
    }

    // Tooltip mirrors the run activity log verbs plus the full fixed timestamp, since the chip
    // itself only shows relative time.
    const tooltipContent = tooltipLabel(action, subjectUserId, subjectName, absolute);

    return (
        <WithTooltip
            id={`checked-chip-tooltip-${item.id ?? ''}-${item.state_modified}`}
            title={tooltipContent}
        >
            <Chip data-testid='checklist-item-checked-chip'>
                {subjectUserId ? (
                    <Profile
                        userId={subjectUserId}
                        withoutName={true}
                    />
                ) : null}
                {label}
            </Chip>
        </WithTooltip>
    );
};

const parseDetails = (raw: string): TaskStateModifiedDetails | null => {
    try {
        return JSON.parse(raw) as TaskStateModifiedDetails;
    } catch {
        return null;
    }
};

const parseAction = (raw?: string): StateAction | undefined => {
    const action = raw ? parseDetails(raw)?.action : undefined;
    return (action && action in ICON_FOR_ACTION) ? action as StateAction : undefined;
};

function chipLabel(action: StateAction, time: React.ReactNode): React.ReactNode {
    switch (action) {
    case 'check':
        return (
            <FormattedMessage
                defaultMessage='Checked {time}'
                values={{time}}
            />
        );
    case 'skip':
        return (
            <FormattedMessage
                defaultMessage='Skipped {time}'
                values={{time}}
            />
        );
    case 'restore':
        return (
            <FormattedMessage
                defaultMessage='Restored {time}'
                values={{time}}
            />
        );
    case 'uncheck':
    default:
        return (
            <FormattedMessage
                defaultMessage='Unchecked {time}'
                values={{time}}
            />
        );
    }
}

function tooltipLabel(action: StateAction, subjectUserId: string, user: React.ReactNode, time: React.ReactNode): React.ReactNode {
    if (subjectUserId) {
        switch (action) {
        case 'check':
            return (
                <FormattedMessage
                    defaultMessage='{user} checked off {time}'
                    values={{user, time}}
                />
            );
        case 'skip':
            return (
                <FormattedMessage
                    defaultMessage='{user} skipped {time}'
                    values={{user, time}}
                />
            );
        case 'restore':
            return (
                <FormattedMessage
                    defaultMessage='{user} restored {time}'
                    values={{user, time}}
                />
            );
        case 'uncheck':
        default:
            return (
                <FormattedMessage
                    defaultMessage='{user} unchecked {time}'
                    values={{user, time}}
                />
            );
        }
    }
    switch (action) {
    case 'check':
        return (
            <FormattedMessage
                defaultMessage='Checked off {time}'
                values={{time}}
            />
        );
    case 'skip':
        return (
            <FormattedMessage
                defaultMessage='Skipped {time}'
                values={{time}}
            />
        );
    case 'restore':
        return (
            <FormattedMessage
                defaultMessage='Restored {time}'
                values={{time}}
            />
        );
    case 'uncheck':
    default:
        return (
            <FormattedMessage
                defaultMessage='Unchecked {time}'
                values={{time}}
            />
        );
    }
}

/**
 * Resolve the timeline event for this item's last state change, or undefined when it can't be
 * determined confidently. The link between a timeline event and a checklist item is imperfect (the
 * event stores only the action + the markdown-stripped task title — no item id reaches the
 * frontend), so we never guess:
 *   1. The event's action must be one the item's resting state could have produced (`allowedActions`)
 *      — this keeps a stale/contradictory event from matching (e.g. a `check` event against an Open
 *      item) and disambiguates uncheck vs. restore for Open items.
 *   2. The event's event_at MUST equal this item's state_modified — the backend sets both from the
 *      same clock read, so this is the authoritative key. A single matching event is the match.
 *   3. If several share that millisecond (e.g. a bulk/API action), disambiguate by title; use it
 *      only when exactly one title matches.
 * Title is never used as a sole link — only as a tiebreaker among exact event_at matches. Any
 * remaining ambiguity returns undefined so the chip omits attribution rather than mis-attributing.
 */
function useStateEvent(events: TimelineEvent[] | undefined, item: ChecklistItem, show: boolean, allowedActions: StateAction[]): TimelineEvent | undefined {
    const allowedKey = allowedActions.join(',');
    return useMemo(() => {
        if (!show || !item.state_modified || !events) {
            return undefined;
        }

        const matches = events.filter((e) => {
            if (e.event_type !== TimelineEventType.TaskStateModified) {
                return false;
            }
            const action = parseAction(e.details);
            return action !== undefined && allowedActions.includes(action);
        });

        const titleMatches = (raw: string) => parseDetails(raw)?.task === item.title;

        // event_at must always equal state_modified; title alone is never a sufficient link.
        const exact = matches.filter((e) => e.event_at === item.state_modified);
        if (exact.length === 1) {
            return exact[0];
        }
        if (exact.length > 1) {
            // Same-millisecond collision (e.g. bulk/API action): disambiguate by title, and only
            // when exactly one title matches.
            const byTitle = exact.filter((e) => titleMatches(e.details));
            return byTitle.length === 1 ? byTitle[0] : undefined;
        }
        return undefined;

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [events, item.state_modified, item.title, show, allowedKey]);
}

const Chip = styled.div`
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    height: 24px;
    padding: 2px 8px;
    gap: 4px;
    border-radius: 13px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: var(--center-channel-color);
    font-size: 12px;
    line-height: 16px;
    white-space: nowrap;

    .PlaybookRunProfile {
        margin: 0;
    }

    .PlaybookRunProfile .image {
        width: 16px;
        height: 16px;
        margin: 0;
    }
`;

export default CheckedChip;
