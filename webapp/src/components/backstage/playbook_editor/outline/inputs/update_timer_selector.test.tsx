// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import UpdateTimer from './update_timer_selector';

// Capture the props UpdateTimer hands to the selector so the option/value mapping can be asserted
// directly. The real DateTimeSelector pulls in a dropdown and portal that add nothing here.
let lastProps: any;
jest.mock('src/components/datetime_selector', () => ({
    __esModule: true,
    default: (props: any) => {
        lastProps = props;
        return <div data-testid='datetime-selector'/>;
    },
}));

jest.mock('src/components/backstage/playbook_editor/outline/section_status_updates', () => ({
    Placeholder: ({label}: {label: string}) => <span data-testid='placeholder'>{label}</span>,
}));

const render = (seconds: number) => {
    lastProps = undefined;
    renderer.create(
        <IntlProvider locale='en'>
            <UpdateTimer
                seconds={seconds}
                setSeconds={jest.fn()}
            />
        </IntlProvider>,
    );
    return lastProps;
};

// The 0 -> "Never" mapping rests on a truthiness check inside UpdateTimer, so these cases guard
// against 0 being re-treated as "unset" and silently replaced by a duration (MM-46380).
describe('UpdateTimer', () => {
    it('selects the Never option when the timer is 0', () => {
        const props = render(0);

        expect(props.suggestedOptions[0].value).toBeNull();
        expect(props.placeholder.props.label).toBe('never');
    });

    it('selects the matching duration when the timer is set', () => {
        const props = render(24 * 60 * 60);

        expect(props.placeholder.props.label).not.toBe('never');
        expect(props.placeholder.props.label).toEqual(expect.stringMatching(/day|24/i));
    });

    it('always offers Never as the leading option', () => {
        for (const seconds of [0, 60 * 60, 24 * 60 * 60, 7 * 24 * 60 * 60, 12345]) {
            const props = render(seconds);

            const nevers = props.suggestedOptions.filter((o: any) => o.value === null);
            expect(nevers).toHaveLength(1);
            expect(props.suggestedOptions[0].value).toBeNull();
        }
    });

    it('keeps a non-standard duration selectable alongside the presets', () => {
        const props = render(12345);

        expect(props.suggestedOptions.length).toBeGreaterThan(4);
        expect(props.placeholder.props.label).not.toBe('never');
    });
});
