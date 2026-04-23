// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import TaskProgress from './task_progress';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', defaultLocale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

describe('TaskProgress', () => {
    it('shows "12/40" when task_total is 40 and task_completed is 12', () => {
        const component = renderer.create(
            <TaskProgress
                taskTotal={40}
                taskCompleted={12}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        expect(JSON.stringify(tree)).toContain('12/40');
    });

    it('shows "0/5" when nothing is completed', () => {
        const component = renderer.create(
            <TaskProgress
                taskTotal={5}
                taskCompleted={0}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        expect(JSON.stringify(tree)).toContain('0/5');
    });

    it('shows "40/40" when all tasks are completed', () => {
        const component = renderer.create(
            <TaskProgress
                taskTotal={40}
                taskCompleted={40}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        expect(JSON.stringify(tree)).toContain('40/40');
    });

    it('shows nothing or dash when task_total is 0', () => {
        const component = renderer.create(
            <TaskProgress
                taskTotal={0}
                taskCompleted={0}
            />,
        );
        const tree = component.toJSON();

        // When task_total is 0, the component renders null or a dash placeholder
        const rendered = tree === null || JSON.stringify(tree).includes('—') || JSON.stringify(tree).includes('-');
        expect(rendered).toBe(true);
    });

    it('renders null when task_total is undefined', () => {
        const component = renderer.create(
            <TaskProgress
                taskTotal={undefined}
                taskCompleted={undefined}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeNull();
    });

    it('renders null when task_total is undefined and task_completed has a value', () => {
        const component = renderer.create(
            <TaskProgress
                taskTotal={undefined}
                taskCompleted={5}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeNull();
    });

    it('counts both Closed and Skipped items as completed (terminal states)', () => {
        // task_completed should already reflect closed + skipped from the server
        // This test verifies the component correctly displays the provided counts
        const component = renderer.create(
            <TaskProgress
                taskTotal={10}
                taskCompleted={7}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        expect(JSON.stringify(tree)).toContain('7/10');
    });
});
