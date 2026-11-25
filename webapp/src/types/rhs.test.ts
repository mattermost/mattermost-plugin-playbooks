// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimelineEventType, isPhaseEventType} from './rhs';

describe('isPhaseEventType', () => {
    it('is true for every event that records a phase, which cannot be deleted', () => {
        for (const type of [
            TimelineEventType.PhaseStarted,
            TimelineEventType.PhaseDone,
            TimelineEventType.PhaseReopened,
            TimelineEventType.CurrentPhaseChanged,
        ]) {
            expect(isPhaseEventType(type)).toBe(true);
        }
    });

    it('is false for the events that can be deleted', () => {
        for (const type of [
            TimelineEventType.StatusUpdated,
            TimelineEventType.TaskStateModified,
            TimelineEventType.OwnerChanged,
            TimelineEventType.EventFromPost,
        ]) {
            expect(isPhaseEventType(type)).toBe(false);
        }
    });
});
