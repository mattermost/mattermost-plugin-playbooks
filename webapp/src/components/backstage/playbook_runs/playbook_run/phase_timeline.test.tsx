// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';

import {RunPhase} from 'src/types/playbook_run';

import PhaseTimeline from './phase_timeline';

const NOW = Date.UTC(2026, 0, 1, 18, 0);
const MINUTE = 60 * 1000;

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', timeZone: 'UTC'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/hooks', () => ({
    useNow: () => ({valueOf: () => Date.UTC(2026, 0, 1, 18, 0)}),
}));

const phase = (title: string, overrides: Partial<RunPhase> = {}): RunPhase => ({
    checklist_id: title.toLowerCase(),
    title,
    status: 'not_started',
    current: false,
    tasks_open: 0,
    tasks_total: 0,
    started_at: 0,
    ended_at: 0,
    ...overrides,
});

const render = (phases: RunPhase[]) => renderer.create(<PhaseTimeline phases={phases}/>);

const steps = (phases: RunPhase[]) => render(phases).root.findAll((n) => n.type === 'div' && n.props.role === 'listitem');

describe('PhaseTimeline', () => {
    it('renders nothing without phases', () => {
        expect(render([]).toJSON()).toBeNull();
    });

    it('labels every phase with its status and which one is current', () => {
        const labels = steps([
            phase('Triage', {status: 'done'}),
            phase('Containment', {status: 'started', tasks_open: 2, tasks_total: 5}),
            phase('Eradication', {status: 'started', current: true}),
            phase('Recovery', {status: 'blocked'}),
            phase('Review', {status: 'skipped'}),
            phase('Closed', {status: 'not_started'}),
        ]).map((n) => n.props['aria-label']);

        expect(labels).toEqual([
            'Triage: Done',
            'Containment: In progress',
            'Eradication: In progress, current phase',
            'Recovery: Blocked',
            'Review: Skipped',
            'Closed: Not started',
        ]);
    });

    it('calls the current phase that has not started the one up next', () => {
        const [first, second] = steps([
            phase('Triage', {status: 'done'}),
            phase('Containment', {current: true}),
        ]).map((n) => n.props['aria-label']);

        expect(first).toBe('Triage: Done');
        expect(second).toBe('Containment: Up next');
    });

    it('does not show a skipped phase as done', () => {
        const [skipped] = steps([phase('Review', {status: 'skipped'})]);

        expect(skipped.props['data-status']).toBe('skipped');
        expect(skipped.props['aria-label']).not.toContain('Done');
    });

    it('tells how many tasks are still open on a phase the run moved past', () => {
        const titles = render([
            phase('Containment', {status: 'started', tasks_open: 2, tasks_total: 5, started_at: NOW - (90 * MINUTE)}),
            phase('Eradication', {status: 'started', current: true, tasks_open: 1, tasks_total: 4, started_at: NOW - (30 * MINUTE)}),
            phase('Triage', {status: 'done', tasks_total: 3}),
        ]).root.findAll((n) => n.type === 'div' && typeof n.props.title === 'string').map((n) => n.props.title);

        expect(titles).toEqual([
            'In progress, 2 of 5 tasks open',
            'In progress, 1 of 4 tasks open',
            'Done',
        ]);
    });

    it('shows how long each phase took, until now while active and until it ended once finished', () => {
        const text = JSON.stringify(render([
            phase('A', {status: 'done', started_at: NOW - (200 * MINUTE), ended_at: NOW - (75 * MINUTE)}),
            phase('B', {status: 'started', current: true, started_at: NOW - (45 * MINUTE)}),
            phase('C', {status: 'blocked', started_at: NOW - (10 * MINUTE)}),
            phase('D', {status: 'started', started_at: NOW - (100 * MINUTE), ended_at: NOW - (80 * MINUTE)}),
            phase('E'),
        ]).toJSON());

        // Done: 125 minutes from start to end. Moved past with open tasks: start to when the next started.
        expect(text).toContain('2h, 5m');
        expect(text).toContain('20m');
        expect(text).toContain('45m');
        expect(text).toContain('10m');
        expect(text).not.toContain('ago');
    });

    it('shows no time for phases that have not started or were skipped', () => {
        const times = render([
            phase('A', {status: 'skipped'}),
            phase('B', {current: true}),
        ]).root.findAll((n) => n.type === 'div' && n.props.className?.includes('Time'));

        expect(times.map((n) => n.children.length)).toEqual([0, 0]);
    });
});
