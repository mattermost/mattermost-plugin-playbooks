// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Checklist, ChecklistItemState} from 'src/types/playbook';

import {countTasks} from './embedded_checklist_header';

const checklist = (items: Array<{state: string; condition_action?: string}>) => ({title: 'c', items}) as unknown as Checklist;

describe('countTasks', () => {
    it('counts closed and skipped items as done', () => {
        const result = countTasks([checklist([
            {state: ChecklistItemState.Open},
            {state: ChecklistItemState.InProgress},
            {state: ChecklistItemState.Closed},
            {state: ChecklistItemState.Skip},
        ])]);

        expect(result).toEqual({total: 4, done: 2});
    });

    it('ignores items hidden by a condition', () => {
        const result = countTasks([checklist([
            {state: ChecklistItemState.Closed, condition_action: 'hidden'},
            {state: ChecklistItemState.Open},
        ])]);

        expect(result).toEqual({total: 1, done: 0});
    });

    it('adds up across sections and handles none', () => {
        expect(countTasks([])).toEqual({total: 0, done: 0});
        expect(countTasks([
            checklist([{state: ChecklistItemState.Closed}]),
            checklist([{state: ChecklistItemState.Open}]),
        ])).toEqual({total: 2, done: 1});
    });
});
