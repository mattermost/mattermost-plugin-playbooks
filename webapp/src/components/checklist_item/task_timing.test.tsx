// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';

import {ChecklistItem, ChecklistItemState, emptyChecklistItem} from 'src/types/playbook';
import {ChecklistItemTiming, RunTiming} from 'src/types/run_timing';

import TaskTiming from './task_timing';
import {RunTimingContext, indexRunTiming} from './run_timing_context';

const NOW = 10 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/hooks', () => ({
    useNow: () => ({valueOf: () => 10 * 60 * 60 * 1000}),
    useEnsureProfiles: () => undefined,
    useFormattedUsernames: (ids: string[]) => ids.map((id) => `user-${id}`),
}));

const item = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
    ...emptyChecklistItem(),
    id: 'item1',
    title: 'Notify regulator',
    ...overrides,
});

const itemTiming = (overrides: Partial<ChecklistItemTiming> = {}): ChecklistItemTiming => ({
    checklist_id: 'c1',
    item_id: 'item1',
    started_at: 0,
    finished_at: 0,
    reopened: false,
    blocked_millis: 0,
    block_count: 0,
    blocked_since: 0,
    ...overrides,
});

const render = (checklistItem: ChecklistItem, items: ChecklistItemTiming[], {computedAt = NOW, runEnded = false} = {}) => {
    const timing: RunTiming = {items, duration_millis: 0, waiting_millis: 0, blocked_items: 0, metrics: [], computed_at: computedAt};
    return renderer.create(
        <RunTimingContext.Provider value={indexRunTiming(timing, runEnded)}>
            <TaskTiming item={checklistItem}/>
        </RunTimingContext.Provider>,
    );
};

const text = (component: renderer.ReactTestRenderer) => JSON.stringify(component.toJSON());

describe('TaskTiming', () => {
    it('renders nothing for an item with no history', () => {
        expect(render(item(), []).toJSON()).toBeNull();
    });

    it('shows how long a finished task took', () => {
        const component = render(item({state: ChecklistItemState.Closed}), [
            itemTiming({started_at: NOW - (30 * MINUTE), finished_at: NOW - (5 * MINUTE)}),
        ]);

        expect(text(component)).toContain('Took 25m');
    });

    it('shows the blocked reason and counts the open block up to now', () => {
        const component = render(
            item({state: ChecklistItemState.Blocked, blocked_reason: 'Waiting on legal'}),
            [itemTiming({started_at: NOW - (60 * MINUTE), blocked_millis: 10 * MINUTE, block_count: 1, blocked_since: NOW - (10 * MINUTE)})],
            {computedAt: NOW - (5 * MINUTE)},
        );

        expect(text(component)).toContain('Blocked: Waiting on legal');
        expect(text(component)).toContain('Blocked once, 15m in total');
        expect(text(component)).toContain('Started 1h ago');
    });

    it('does not keep counting once the run has ended', () => {
        const component = render(
            item({state: ChecklistItemState.Blocked, blocked_reason: 'Waiting on legal'}),
            [itemTiming({blocked_millis: 10 * MINUTE, block_count: 1, blocked_since: NOW - (10 * MINUTE)})],
            {computedAt: NOW - (5 * MINUTE), runEnded: true},
        );

        expect(text(component)).toContain('Blocked once, 10m in total');
    });

    it('counts recurring blocks', () => {
        const component = render(item({state: ChecklistItemState.InProgress}), [
            itemTiming({started_at: NOW - (60 * MINUTE), blocked_millis: 20 * MINUTE, block_count: 3}),
        ]);

        expect(text(component)).toContain('Blocked 3 times, 20m in total');
    });

    it('names who the task is blocked by', () => {
        const component = render(
            item({state: ChecklistItemState.Blocked, blocked_reason: 'Waiting on legal', blocked_by_user_ids: ['u1', 'u2']}),
            [itemTiming({blocked_since: NOW - MINUTE, block_count: 1})],
        );

        expect(text(component)).toContain('Blocked by @user-u1, @user-u2: Waiting on legal');
    });

    it('marks a started task as in progress', () => {
        const component = render(item({state: ChecklistItemState.InProgress}), [
            itemTiming({started_at: NOW - (5 * MINUTE)}),
        ]);

        expect(component.root.findAllByProps({'data-testid': 'task-in-progress'}).length).toBeGreaterThan(0);
    });

    it('flags a task that was reopened', () => {
        const component = render(item(), [
            itemTiming({started_at: NOW - (30 * MINUTE), finished_at: NOW - (20 * MINUTE), reopened: true}),
        ]);

        expect(text(component)).toContain('Reopened');
    });

    it('still shows the blocked reason without timing data', () => {
        const component = renderer.create(
            <TaskTiming item={item({state: ChecklistItemState.Blocked, blocked_reason: 'Waiting on legal'})}/>,
        );

        expect(text(component)).toContain('Blocked: Waiting on legal');
    });
});
