// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import {RunPhase} from 'src/types/playbook_run';

import PhaseTimeline from './phase_timeline';

const NOW = Date.UTC(2026, 0, 1, 18, 0);
const MINUTE = 60 * 1000;

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', timeZone: 'UTC'});
    return {...reactIntl, useIntl: () => intl};
});

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => jest.fn(),
    useAppSelector: () => undefined,
}));

jest.mock('mattermost-redux/actions/users', () => ({getUser: jest.fn()}));
jest.mock('mattermost-redux/selectors/entities/users', () => ({getUser: jest.fn()}));

jest.mock('src/components/widgets/confirmation_modal', () => (props: {show: boolean}) => (props.show ? <div data-testid='confirm'/> : null));

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

// Triage is done, Containment is the current phase, Recovery has not started.
const phases = [
    phase('Triage', {status: 'done', started_at: NOW - (30 * MINUTE), ended_at: NOW - (20 * MINUTE)}),
    phase('Containment', {status: 'started', current: true, started_at: NOW - (20 * MINUTE)}),
    phase('Recovery'),
];

const setup = (list: RunPhase[] = phases, allowed = true) => {
    const onMove = jest.fn();
    const onPhaseState = jest.fn();
    render(
        <PhaseTimeline
            phases={list}
            custom={true}
            onMove={allowed ? onMove : undefined}
            onPhaseState={allowed ? onPhaseState : undefined}
        />,
    );
    return {onMove, onPhaseState};
};

describe('PhaseTimeline with phases of the run\'s own', () => {
    describe('the header', () => {
        it('names the current phase and how long it has run, without saying who or what moved it', () => {
            setup();

            expect(screen.getByTestId('phase-timeline-current').textContent).toBe('Containment');
            expect(screen.getByTestId('phase-timeline-detail').textContent).toBe('for 20m');
        });
    });

    describe('moving to the next phase', () => {
        it('moves on and finishes the current phase from the main button, with no confirmation', () => {
            const {onMove} = setup();

            expect(screen.getByTestId('phase-timeline-next').textContent).toBe('Move to Recovery');
            fireEvent.click(screen.getByTestId('phase-timeline-next'));

            expect(onMove).toHaveBeenCalledWith(true);
            expect(screen.queryByTestId('confirm')).toBeNull();
        });

        it('can move on and keep the current phase open, from the menu next to the button', () => {
            const {onMove} = setup();

            expect(screen.queryByTestId('phase-timeline-keep-open')).toBeNull();
            fireEvent.click(screen.getByTestId('phase-timeline-next-menu'));
            expect(screen.getByTestId('phase-timeline-keep-open').textContent).toBe('Move to Recovery and keep Containment open');
            fireEvent.click(screen.getByTestId('phase-timeline-keep-open'));

            expect(onMove).toHaveBeenCalledWith(false);
            expect(screen.queryByTestId('phase-timeline-keep-open')).toBeNull();
        });

        it('closes the menu on Escape and when clicking elsewhere', () => {
            setup();

            fireEvent.click(screen.getByTestId('phase-timeline-next-menu'));
            fireEvent.keyDown(document, {key: 'Escape'});
            expect(screen.queryByTestId('phase-timeline-keep-open')).toBeNull();

            fireEvent.click(screen.getByTestId('phase-timeline-next-menu'));
            fireEvent.mouseDown(document.body);
            expect(screen.queryByTestId('phase-timeline-keep-open')).toBeNull();
        });

        it('has no menu to keep a phase open when the current phase is already done', () => {
            setup([
                phase('Triage', {status: 'done', current: true, started_at: NOW - (30 * MINUTE), ended_at: NOW - (20 * MINUTE)}),
                phase('Containment'),
            ]);

            expect(screen.getByTestId('phase-timeline-next').textContent).toBe('Move to Containment');
            expect(screen.queryByTestId('phase-timeline-next-menu')).toBeNull();
        });
    });

    describe('the last phase', () => {
        const last = [
            phase('Triage', {status: 'done', started_at: NOW - (30 * MINUTE), ended_at: NOW - (20 * MINUTE)}),
            phase('Closed', {status: 'started', current: true, started_at: NOW - (20 * MINUTE)}),
        ];

        it('is finished with a button of its own, which does not move anywhere', () => {
            const {onMove, onPhaseState} = setup(last);

            expect(screen.queryByTestId('phase-timeline-next')).toBeNull();
            expect(screen.queryByTestId('phase-timeline-next-menu')).toBeNull();
            expect(screen.getByTestId('phase-timeline-finish').textContent).toBe('Finish Closed');
            fireEvent.click(screen.getByTestId('phase-timeline-finish'));

            expect(onPhaseState).toHaveBeenCalledWith('closed', 'done');
            expect(onMove).not.toHaveBeenCalled();
        });

        it('has no button once it is done', () => {
            setup([last[0], {...last[1], status: 'done', ended_at: NOW - MINUTE}]);

            expect(screen.queryByTestId('phase-timeline-next')).toBeNull();
            expect(screen.queryByTestId('phase-timeline-finish')).toBeNull();
        });
    });

    describe('the circle of a phase', () => {
        it('is a button only for a phase that is started or done', () => {
            setup();

            expect(screen.getAllByTestId('phase-marker').map((button) => button.getAttribute('aria-label'))).toEqual([
                'Options for phase Triage',
                'Options for phase Containment',
            ]);
        });

        it('offers to mark a started phase done', () => {
            const {onPhaseState} = setup();

            fireEvent.click(screen.getByRole('button', {name: 'Options for phase Containment'}));
            expect(screen.getByTestId('phase-marker-action').textContent).toBe('Mark as done');
            fireEvent.click(screen.getByTestId('phase-marker-action'));

            expect(onPhaseState).toHaveBeenCalledWith('containment', 'done');
            expect(screen.queryByTestId('phase-marker-action')).toBeNull();
        });

        it('offers to reopen a done phase', () => {
            const {onPhaseState} = setup();

            fireEvent.click(screen.getByRole('button', {name: 'Options for phase Triage'}));
            expect(screen.getByTestId('phase-marker-action').textContent).toBe('Reopen');
            fireEvent.click(screen.getByTestId('phase-marker-action'));

            expect(onPhaseState).toHaveBeenCalledWith('triage', 'started');
        });

        it('opens one menu at a time', () => {
            setup();

            fireEvent.click(screen.getByRole('button', {name: 'Options for phase Triage'}));
            fireEvent.click(screen.getByRole('button', {name: 'Options for phase Containment'}));

            expect(screen.getAllByTestId('phase-marker-action')).toHaveLength(1);
            expect(screen.getByTestId('phase-marker-action').textContent).toBe('Mark as done');
        });
    });

    describe('for someone who may not move the phases', () => {
        it('shows the timeline without any control', () => {
            setup(phases, false);

            expect(screen.getByTestId('phase-timeline-current').textContent).toBe('Containment');
            expect(screen.queryByTestId('phase-timeline-next')).toBeNull();
            expect(screen.queryByTestId('phase-timeline-next-menu')).toBeNull();
            expect(screen.queryByTestId('phase-timeline-finish')).toBeNull();
            expect(screen.queryAllByTestId('phase-marker')).toHaveLength(0);
        });
    });
});
