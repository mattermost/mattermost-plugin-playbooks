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
            {checklist_id: 'triage', title: 'Triage', status: 'done', timestamp: Date.UTC(2026, 0, 1, 14, 44)},
            {checklist_id: 'containment', title: 'Containment', status: 'blocked', timestamp: Date.UTC(2026, 0, 1, 16, 39)},
            {checklist_id: 'eradication', title: 'Eradication', status: 'started', timestamp: Date.UTC(2026, 0, 1, 17, 10)},
            {checklist_id: 'recovery', title: 'Recovery', status: 'not_started', timestamp: 0},
        ]).root;

        const labels = root.findAll((n) => n.type === 'div' && n.props.role === 'listitem').map((n) => n.props['aria-label']);
        expect(labels).toEqual([
            'Triage: Done',
            'Containment: Blocked',
            'Eradication: In progress',
            'Recovery: Not started',
        ]);
    });

    it('shows elapsed time, and nothing for phases that have not started', () => {
        const text = JSON.stringify(render([
            {checklist_id: 'a', title: 'A', status: 'done', timestamp: NOW - (125 * MINUTE)},
            {checklist_id: 'b', title: 'B', status: 'started', timestamp: NOW - (45 * MINUTE)},
            {checklist_id: 'c', title: 'C', status: 'blocked', timestamp: NOW - (5 * MINUTE)},
            {checklist_id: 'd', title: 'D', status: 'not_started', timestamp: 0},
        ]).toJSON());

        expect(text).toContain('2h ago');
        expect(text).toContain('for 45m');
        expect(text).toContain('for 5m');
        expect(text).not.toContain('PM');
    });
});
