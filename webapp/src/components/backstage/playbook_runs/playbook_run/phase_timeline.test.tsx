// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';

import {RunPhase} from 'src/types/playbook_run';

import PhaseTimeline from './phase_timeline';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', timeZone: 'UTC'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

const NOW = Date.UTC(2026, 0, 1, 18, 0);
const MINUTE = 60 * 1000;

jest.mock('src/hooks', () => ({
    useNow: () => ({valueOf: () => Date.UTC(2026, 0, 1, 18, 0)}),
}));

const render = (phases: RunPhase[]) => renderer.create(<PhaseTimeline phases={phases}/>);

describe('PhaseTimeline', () => {
    it('renders nothing without phases', () => {
        expect(render([]).toJSON()).toBeNull();
    });

    it('labels every phase with its status', () => {
        const root = render([
            {checklist_id: 'triage', title: 'Triage', status: 'done', started_at: Date.UTC(2026, 0, 1, 14, 44), ended_at: 0},
            {checklist_id: 'containment', title: 'Containment', status: 'blocked', started_at: Date.UTC(2026, 0, 1, 14, 44), ended_at: 0},
            {checklist_id: 'eradication', title: 'Eradication', status: 'started', started_at: Date.UTC(2026, 0, 1, 14, 44), ended_at: 0},
            {checklist_id: 'recovery', title: 'Recovery', status: 'not_started', started_at: 0, ended_at: 0},
        ]).root;

        const labels = root.findAll((n) => n.type === 'div' && n.props.role === 'listitem').map((n) => n.props['aria-label']);
        expect(labels).toEqual([
            'Triage: Done',
            'Containment: Blocked',
            'Eradication: In progress',
            'Recovery: Not started',
        ]);
    });

    it('shows how long each phase took, until now while active and until done once finished', () => {
        const text = JSON.stringify(render([
            {checklist_id: 'a', title: 'A', status: 'done', started_at: NOW - (200 * MINUTE), ended_at: NOW - (75 * MINUTE)},
            {checklist_id: 'b', title: 'B', status: 'started', started_at: NOW - (45 * MINUTE), ended_at: 0},
            {checklist_id: 'c', title: 'C', status: 'blocked', started_at: NOW - (10 * MINUTE), ended_at: 0},
            {checklist_id: 'd', title: 'D', status: 'not_started', started_at: 0, ended_at: 0},
        ]).toJSON());

        // Done: 125 minutes from start to end. Active: from start to now.
        expect(text).toContain('2h, 5m');
        expect(text).toContain('45m');
        expect(text).toContain('10m');
        expect(text).not.toContain('ago');
    });
});
