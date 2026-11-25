// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimelineEvent, TimelineEventType} from 'src/types/rhs';

import {phaseDurations} from './timeline_utils';

jest.mock('react-intl', () => ({useIntl: jest.fn()}));
jest.mock('src/hooks/redux', () => ({useAppDispatch: jest.fn(), useAppSelector: jest.fn()}));

let nextId = 0;
const phaseEvent = (type: TimelineEventType, checklistId: string, at: number, overrides: Partial<TimelineEvent> = {}): TimelineEvent => ({
    id: `event${nextId++}`,
    playbook_run_id: 'run1',
    create_at: at,
    delete_at: 0,
    event_at: at,
    event_type: type,
    summary: '',
    details: JSON.stringify({checklist_id: checklistId, title: checklistId}),
    post_id: '',
    subject_user_id: '',
    creator_user_id: '',
    ...overrides,
});

describe('phaseDurations', () => {
    it('measures a phase from when it started until it was done', () => {
        const started = phaseEvent(TimelineEventType.PhaseStarted, 'c1', 1000);
        const done = phaseEvent(TimelineEventType.PhaseDone, 'c1', 8000);

        expect(phaseDurations([started, done])).toEqual({[done.id]: 7000});
    });

    it('counts from the first start, so a reopened phase includes the time it was done', () => {
        const started = phaseEvent(TimelineEventType.PhaseStarted, 'c1', 1000);
        const firstDone = phaseEvent(TimelineEventType.PhaseDone, 'c1', 2000);
        const reopened = phaseEvent(TimelineEventType.PhaseReopened, 'c1', 3000);
        const secondDone = phaseEvent(TimelineEventType.PhaseDone, 'c1', 9000);

        expect(phaseDurations([started, firstDone, reopened, secondDone])).toEqual({
            [firstDone.id]: 1000,
            [secondDone.id]: 8000,
        });
    });

    it('keeps phases apart', () => {
        const events = [
            phaseEvent(TimelineEventType.PhaseStarted, 'c1', 1000),
            phaseEvent(TimelineEventType.PhaseStarted, 'c2', 4000),
            phaseEvent(TimelineEventType.PhaseDone, 'c2', 6000),
        ];

        expect(Object.values(phaseDurations(events))).toEqual([2000]);
    });

    it('gives nothing for a phase without a start, one done within a second, or invalid details', () => {
        const events = [
            phaseEvent(TimelineEventType.PhaseDone, 'c1', 5000),
            phaseEvent(TimelineEventType.PhaseStarted, 'c2', 7000),
            phaseEvent(TimelineEventType.PhaseDone, 'c2', 7400),
            phaseEvent(TimelineEventType.PhaseDone, 'c3', 9000, {details: 'not json'}),
        ];

        expect(phaseDurations(events)).toEqual({});
    });

    it('ignores starts that were deleted', () => {
        const events = [
            phaseEvent(TimelineEventType.PhaseStarted, 'c1', 1000, {delete_at: 1}),
            phaseEvent(TimelineEventType.PhaseDone, 'c1', 5000),
        ];

        expect(phaseDurations(events)).toEqual({});
    });
});
