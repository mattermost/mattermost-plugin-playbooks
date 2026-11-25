// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';

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

const mockDispatch = jest.fn();
jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => mockDispatch,
    useAppSelector: () => ({username: 'jane'}),
}));

jest.mock('mattermost-redux/actions/users', () => ({getUser: jest.fn()}));
jest.mock('mattermost-redux/selectors/entities/users', () => ({getUser: jest.fn()}));

jest.mock('src/components/widgets/confirmation_modal', () => (props: {show: boolean, message: string, onConfirm: () => void}) => (props.show ? (
    <button
        data-testid='confirm'
        onClick={props.onConfirm}
    >{props.message}</button>
) : null));

const mockUseNow = jest.fn();
jest.mock('src/hooks', () => ({
    useNow: (interval: number) => {
        mockUseNow(interval);
        return {valueOf: () => Date.UTC(2026, 0, 1, 18, 0)};
    },
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

    it('rounds to whole minutes, and shows seconds only under a minute', () => {
        const text = JSON.stringify(render([
            phase('A', {status: 'started', started_at: NOW - (95 * 1000)}),
            phase('B', {status: 'started', started_at: NOW - (45 * 1000)}),
            phase('C', {status: 'started', started_at: NOW - (((3 * 60) + 59) * 1000)}),
        ]).toJSON());

        expect(text).toContain('1m');
        expect(text).toContain('45s');
        expect(text).toContain('3m');
        expect(text).not.toContain('1m, 35s');
        expect(text).not.toContain('3m, 59s');
    });

    it('shows no time for a phase that started and ended at the same moment', () => {
        const times = render([phase('A', {status: 'done', started_at: NOW - MINUTE, ended_at: NOW - MINUTE})])
            .root.findAll((n) => n.type === 'div' && n.props.className?.includes('Time'));

        expect(times.map((n) => n.children.length)).toEqual([0]);
    });

    describe('refreshing', () => {
        beforeEach(() => {
            mockUseNow.mockClear();
            jest.spyOn(Date, 'now').mockReturnValue(NOW);
        });
        afterEach(() => jest.restoreAllMocks());

        it('refreshes every second while a running time is under a minute', () => {
            render([phase('A', {status: 'started', current: true, started_at: NOW - (20 * 1000)})]);

            expect(mockUseNow).toHaveBeenLastCalledWith(1000);
        });

        it('refreshes every five seconds once times are in minutes', () => {
            render([phase('A', {status: 'started', current: true, started_at: NOW - (5 * MINUTE)})]);

            expect(mockUseNow).toHaveBeenLastCalledWith(5000);
        });

        it('does not tick for a finished phase', () => {
            render([phase('A', {status: 'done', started_at: NOW - (30 * 1000), ended_at: NOW - (10 * 1000)})]);

            expect(mockUseNow).toHaveBeenLastCalledWith(null);
        });

        it('does not refresh at all when every time is fixed', () => {
            render([
                phase('A', {status: 'done', started_at: NOW - (90 * MINUTE), ended_at: NOW - (60 * MINUTE)}),
                phase('B', {status: 'started', started_at: NOW - (50 * MINUTE), ended_at: NOW - (20 * MINUTE)}),
                phase('C'),
            ]);

            expect(mockUseNow).toHaveBeenLastCalledWith(null);
        });
    });

    it('shows no time for phases that have not started or were skipped', () => {
        const times = render([
            phase('A', {status: 'skipped'}),
            phase('B', {current: true}),
        ]).root.findAll((n) => n.type === 'div' && n.props.className?.includes('Time'));

        expect(times.map((n) => n.children.length)).toEqual([0, 0]);
    });

    it('shows no time for a skipped phase even if it carries a start', () => {
        const times = render([
            phase('A', {status: 'skipped', started_at: NOW - (30 * MINUTE), ended_at: NOW - (10 * MINUTE)}),
            phase('B', {status: 'started', started_at: NOW - (30 * MINUTE)}),
        ]).root.findAll((n) => n.type === 'div' && n.props.className?.includes('Time'));

        expect(times.map((n) => n.children.length)).toEqual([0, 1]);
    });

    describe('the current phase header', () => {
        const phases = [
            phase('Triage', {status: 'done'}),
            phase('Containment', {status: 'started', current: true, started_at: NOW - (185 * MINUTE)}),
            phase('Eradication'),
        ];
        const tree = (root: renderer.ReactTestRenderer) => JSON.stringify(root.toJSON());
        const mountWith = (props: Partial<React.ComponentProps<typeof PhaseTimeline>>, list: RunPhase[] = phases) => renderer.create(
            <PhaseTimeline
                phases={list}
                {...props}
            />,
        );

        it('names the current phase and how long it has been going', () => {
            const root = mountWith({});

            expect(root.root.findByProps({'data-testid': 'phase-timeline-current'})).toBeDefined();
            expect(tree(root)).toContain('for 3h, 5m, moved automatically');
        });

        it('says the first phase started with the run, not that it was moved', () => {
            const root = mountWith({}, [
                phase('Triage', {status: 'started', current: true, started_at: NOW - (5 * MINUTE)}),
                phase('Containment'),
            ]);

            expect(tree(root)).toContain('for 5m, started with the run');
            expect(tree(root)).not.toContain('moved automatically');
        });

        it('has no header when no phase is current', () => {
            expect(mountWith({}, [phase('Triage', {status: 'skipped'})]).root.findAllByProps({'data-testid': 'phase-timeline-current'})).toHaveLength(0);
        });

        it('offers no button to someone who may not set the phase, and none on the last phase', () => {
            expect(mountWith({}).root.findAllByProps({'data-testid': 'phase-timeline-next'})).toHaveLength(0);

            const last = [phase('Triage', {status: 'done'}), phase('Closed', {status: 'started', current: true})];
            expect(mountWith({onSetPhase: jest.fn()}, last).root.findAllByProps({'data-testid': 'phase-timeline-next'})).toHaveLength(0);
        });

        it('moves to the next phase, after confirming the first takeover since it is permanent', () => {
            const onSetPhase = jest.fn();
            const root = mountWith({onSetPhase});

            const button = root.root.findByProps({'data-testid': 'phase-timeline-next'});
            expect(tree(root)).toContain('Move to');
            expect(tree(root)).toContain('Eradication');

            act(() => button.props.onClick());
            expect(onSetPhase).not.toHaveBeenCalled();

            act(() => root.root.findByProps({'data-testid': 'confirm'}).props.onClick());
            expect(onSetPhase).toHaveBeenCalledWith('eradication');
        });

        it('moves straight away once the phase is already manual, and says who set it and when', () => {
            const onSetPhase = jest.fn();
            const root = mountWith({onSetPhase, override: {checklist_id: 'containment', set_by: 'u1', set_at: NOW - (125 * MINUTE)}});

            act(() => root.root.findByProps({'data-testid': 'phase-timeline-next'}).props.onClick());
            expect(onSetPhase).toHaveBeenCalledWith('eradication');
            expect(tree(root)).toContain('for 3h, 5m, set by @jane at 3:55 PM');
        });
    });
});
