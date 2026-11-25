// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    fireEvent,
    render,
    screen,
    within,
} from '@testing-library/react';

import CustomPhasesEditor, {MAX_CUSTOM_PHASES, newPhaseId} from './custom_phases_editor';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {...reactIntl, useIntl: () => intl};
});

const phases = [
    {id: 'a'.repeat(26), title: 'Triage'},
    {id: 'b'.repeat(26), title: 'Containment'},
    {id: 'c'.repeat(26), title: 'Recovery'},
];

const setup = (props: Partial<React.ComponentProps<typeof CustomPhasesEditor>> = {}) => {
    const onChange = jest.fn();
    render(
        <CustomPhasesEditor
            phases={phases}
            onChange={onChange}
            {...props}
        />,
    );
    return {onChange, input: screen.getByTestId('custom-phase-input') as HTMLInputElement, add: screen.getByTestId('custom-phase-add') as HTMLButtonElement};
};

const type = (input: HTMLInputElement, value: string) => fireEvent.change(input, {target: {value}});

describe('CustomPhasesEditor', () => {
    describe('adding a phase', () => {
        it('adds the typed name, trimmed, at the end, with a valid id, when the button is pressed', () => {
            const {onChange, input, add} = setup();

            type(input, '  Lessons learned ');
            fireEvent.click(add);

            expect(onChange).toHaveBeenCalledTimes(1);
            const next = onChange.mock.calls[0][0];
            expect(next.map((phase: {title: string}) => phase.title)).toEqual(['Triage', 'Containment', 'Recovery', 'Lessons learned']);
            expect(next[3].id).toMatch(/^[a-z0-9]{26}$/);
            expect(next.slice(0, 3)).toEqual(phases);
            expect(input.value).toBe('');
        });

        it('adds the typed name on Enter', () => {
            const {onChange, input} = setup();

            type(input, 'Review');
            fireEvent.keyDown(input, {key: 'Enter'});

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange.mock.calls[0][0].at(-1).title).toBe('Review');
        });

        it('cannot add an empty or blank name', () => {
            const {onChange, input, add} = setup();

            expect(add.disabled).toBe(true);
            type(input, '   ');
            expect(add.disabled).toBe(true);
            fireEvent.keyDown(input, {key: 'Enter'});

            expect(onChange).not.toHaveBeenCalled();
        });

        it('refuses a name that is already a phase, whatever its case, and says why', () => {
            const {onChange, input, add} = setup();

            type(input, 'containment');

            expect(add.disabled).toBe(true);
            expect(screen.getByRole('alert').textContent).toContain('already a phase');
            fireEvent.keyDown(input, {key: 'Enter'});
            expect(onChange).not.toHaveBeenCalled();
        });

        it('stops at the maximum number of phases', () => {
            const many = Array.from({length: MAX_CUSTOM_PHASES}, (_, i) => ({id: newPhaseId(), title: `Phase ${i}`}));
            const {input, add} = setup({phases: many});

            expect(input.disabled).toBe(true);
            expect(add.disabled).toBe(true);
            expect(screen.getByText(`A playbook can have up to ${MAX_CUSTOM_PHASES} phases.`)).toBeTruthy();
        });

        it('limits the length of a name', () => {
            const {input} = setup();

            expect(input.maxLength).toBe(64);
        });
    });

    describe('the list', () => {
        it('shows the phases in order with their position', () => {
            setup();

            const rows = screen.getAllByTestId('custom-phase-row');
            expect(rows.map((row) => (within(row).getByTestId('custom-phase-name') as HTMLInputElement).value)).toEqual(['Triage', 'Containment', 'Recovery']);
            expect(rows.map((row) => row.textContent)).toEqual(['1', '2', '3']);
        });

        it('says there are no phases yet when the list is empty', () => {
            setup({phases: []});

            expect(screen.getByTestId('custom-phases-empty')).toBeTruthy();
            expect(screen.queryAllByTestId('custom-phase-row')).toHaveLength(0);
        });

        it('deletes the phase whose button was pressed and keeps the rest in order', () => {
            const {onChange} = setup();

            fireEvent.click(screen.getByRole('button', {name: 'Delete phase Containment'}));

            expect(onChange).toHaveBeenCalledWith([phases[0], phases[2]]);
        });
    });

    describe('renaming a phase', () => {
        const nameInput = (index: number) => screen.getAllByTestId('custom-phase-name')[index] as HTMLInputElement;

        it('saves the new name on Enter, keeping the id and the position', () => {
            const {onChange} = setup();

            fireEvent.change(nameInput(1), {target: {value: '  Containing it '}});
            fireEvent.keyDown(nameInput(1), {key: 'Enter'});

            expect(onChange).toHaveBeenCalledWith([phases[0], {id: phases[1].id, title: 'Containing it'}, phases[2]]);
        });

        it('saves the new name when the field is left', () => {
            const {onChange} = setup();

            fireEvent.change(nameInput(0), {target: {value: 'Assess'}});
            fireEvent.blur(nameInput(0));

            expect(onChange).toHaveBeenCalledWith([{id: phases[0].id, title: 'Assess'}, phases[1], phases[2]]);
        });

        it('puts the old name back on Escape', () => {
            const {onChange} = setup();

            fireEvent.change(nameInput(0), {target: {value: 'Something else'}});
            fireEvent.keyDown(nameInput(0), {key: 'Escape'});
            fireEvent.blur(nameInput(0));

            expect(onChange).not.toHaveBeenCalled();
            expect(nameInput(0).value).toBe('Triage');
        });

        it('ignores a name that is empty, unchanged, or taken by another phase', () => {
            const {onChange} = setup();

            for (const value of ['   ', 'Triage', 'recovery']) {
                fireEvent.change(nameInput(0), {target: {value}});
                fireEvent.keyDown(nameInput(0), {key: 'Enter'});
            }

            expect(onChange).not.toHaveBeenCalled();
            expect(nameInput(0).value).toBe('Triage');
        });
    });

    it('can only be looked at when disabled', () => {
        const {input, add} = setup({disabled: true});

        type(input, 'Anything');

        expect(input.disabled).toBe(true);
        expect(add.disabled).toBe(true);
        expect((screen.getAllByTestId('custom-phase-name')[0] as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByRole('button', {name: 'Delete phase Triage'}) as HTMLButtonElement).disabled).toBe(true);
    });
});

describe('newPhaseId', () => {
    it('makes ids like the server does, and different each time', () => {
        const ids = new Set(Array.from({length: 50}, () => newPhaseId()));

        expect(ids.size).toBe(50);
        for (const id of ids) {
            expect(id).toMatch(/^[a-z0-9]{26}$/);
        }
    });
});
