// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';
import {DateTime} from 'luxon';
import {CheckIcon, CheckboxBlankOutlineIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import Profile from 'src/components/profile/profile';
import {PAST_TIME_SPEC} from 'src/components/time_spec';
import {useFormattedUsernameByID} from 'src/hooks';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {TaskStateModifiedDetails, TimelineEvent, TimelineEventType} from 'src/types/rhs';
import {Timestamp} from 'src/webapp_globals';

interface Props {
    item: ChecklistItem;

    // Run timeline events, passed down from the run that holds them via useRun. Read from props —
    // not the Redux store — because the single-run fetch (useRun/useThing) keeps the run in local
    // component state and does not hydrate the store, so a store selector here is unreliable.
    timelineEvents?: TimelineEvent[];

    // compact renders "✓ 5d"; otherwise "Checked 5 days ago" (parallels the "Due ..." chip).
    compact?: boolean;
}

/**
 * CheckedChip shows when a checklist item was last checked off or unchecked, and (best-effort)
 * who did it.
 *
 * The "when" comes purely from the item JSON (`state_modified`) and is always reliable.
 * The "who" is resolved from the run timeline events — see {@link useStateEvent} — and degrades
 * gracefully (no avatar, no name) whenever attribution can't be made confidently.
 */
const CheckedChip = ({item, timelineEvents, compact = false}: Props) => {
    const isChecked = item.state === ChecklistItemState.Closed && item.state_modified > 0;

    // An item changed back to open (state_modified set) was unchecked. Brand-new open items
    // (state_modified === 0) show nothing. A skip→open "restore" is a rare edge that also lands
    // here and reads as "unchecked".
    const isUnchecked = item.state === ChecklistItemState.Open && item.state_modified > 0;
    const action = isChecked ? 'check' : 'uncheck';

    const stateEvent = useStateEvent(timelineEvents, item, isChecked || isUnchecked, action);
    const subjectUserId = stateEvent?.subject_user_id ?? '';
    const subjectName = useFormattedUsernameByID(subjectUserId);

    if (!isChecked && !isUnchecked) {
        return null;
    }

    const value = DateTime.fromMillis(item.state_modified).toJSDate();

    // Full, fixed timestamp for the tooltip, e.g. "Jun 17, 2026, 2:30 PM".
    const absolute = DateTime.fromMillis(item.state_modified).toLocaleString(DateTime.DATETIME_MED);

    const relative = (
        <Timestamp
            value={value}
            units={PAST_TIME_SPEC}
            useTime={false}
        />
    );

    let label;
    if (compact) {
        const Icon = isChecked ? CheckIcon : CheckboxBlankOutlineIcon;
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
    } else if (isChecked) {
        label = (
            <FormattedMessage
                defaultMessage='Checked {time}'
                values={{time: relative}}
            />
        );
    } else {
        label = (
            <FormattedMessage
                defaultMessage='Unchecked {time}'
                values={{time: relative}}
            />
        );
    }

    // Tooltip mirrors the run activity log verbs ("checked off" / "unchecked") plus the full fixed
    // timestamp, since the chip itself only shows relative time.
    let tooltipContent;
    if (isChecked) {
        tooltipContent = subjectUserId ? (
            <FormattedMessage
                defaultMessage='{user} checked off {time}'
                values={{user: subjectName, time: absolute}}
            />
        ) : (
            <FormattedMessage
                defaultMessage='Checked off {time}'
                values={{time: absolute}}
            />
        );
    } else {
        tooltipContent = subjectUserId ? (
            <FormattedMessage
                defaultMessage='{user} unchecked {time}'
                values={{user: subjectName, time: absolute}}
            />
        ) : (
            <FormattedMessage
                defaultMessage='Unchecked {time}'
                values={{time: absolute}}
            />
        );
    }

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

/**
 * Resolve the timeline event for this item's last state change of the given action ("check" or
 * "uncheck"), or undefined when it can't be determined confidently. The link between a timeline
 * event and a checklist item is imperfect (the event stores only the action + the markdown-stripped
 * task title — no item id reaches the frontend), so we never guess:
 *   1. The event's event_at MUST equal this item's state_modified — the backend sets both from the
 *      same clock read, so this is the authoritative key. A single matching-action event is the match.
 *   2. If several share that millisecond (e.g. a bulk/API action), disambiguate by title; use it
 *      only when exactly one title matches.
 * Title is never used as a sole link — only as a tiebreaker among exact event_at matches. Any
 * remaining ambiguity returns undefined so the chip omits attribution rather than mis-attributing.
 */
function useStateEvent(events: TimelineEvent[] | undefined, item: ChecklistItem, show: boolean, action: 'check' | 'uncheck'): TimelineEvent | undefined {
    return useMemo(() => {
        if (!show || !item.state_modified || !events) {
            return undefined;
        }

        const matches = events.filter((e) => {
            if (e.event_type !== TimelineEventType.TaskStateModified) {
                return false;
            }
            return parseDetails(e.details)?.action === action;
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
    }, [events, item.state_modified, item.title, show, action]);
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
