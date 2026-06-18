// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import {ChecklistItem, ChecklistItemState, emptyChecklistItem} from 'src/types/playbook';
import {TimelineEvent, TimelineEventType} from 'src/types/rhs';

import CheckedChip from './checked_chip';

jest.mock('src/components/widgets/tooltip', () => ({
    __esModule: true,
    default: ({children, content}: any) => (
        <div data-testid='tooltip'>
            <span data-testid='tooltip-content'>{content}</span>
            {children}
        </div>
    ),
}));

jest.mock('src/components/profile/profile', () => ({
    __esModule: true,
    default: ({userId}: any) => (
        <span
            data-testid='profile'
            data-userid={userId}
        />
    ),
}));

jest.mock('@mattermost/compass-icons/components', () => ({
    CheckIcon: () => <span data-testid='check-icon'/>,
    CheckboxBlankOutlineIcon: () => <span data-testid='uncheck-icon'/>,
}));

jest.mock('src/webapp_globals', () => ({
    Timestamp: ({value}: any) => (
        <span data-testid='timestamp'>{new Date(value).toISOString()}</span>
    ),
}));

jest.mock('src/hooks', () => ({
    useFormattedUsernameByID: (userId: string) => (userId ? `@${userId}` : ''),
}));

const STATE_MODIFIED = 1700000000000;

const closedItem = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
    ...emptyChecklistItem(),
    title: 'Deploy',
    state: ChecklistItemState.Closed,
    state_modified: STATE_MODIFIED,
    ...overrides,
});

const uncheckedItem = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
    ...emptyChecklistItem(),
    title: 'Deploy',
    state: ChecklistItemState.Open,
    state_modified: STATE_MODIFIED,
    ...overrides,
});

const stateEvent = (action: string, overrides: Partial<TimelineEvent> = {}): TimelineEvent => ({
    id: 'e1',
    playbook_run_id: 'run1',
    create_at: 0,
    delete_at: 0,
    event_at: STATE_MODIFIED,
    event_type: TimelineEventType.TaskStateModified,
    summary: '',
    details: JSON.stringify({action, task: 'Deploy'}),
    post_id: '',
    subject_user_id: 'alice',
    creator_user_id: '',
    ...overrides,
});

const render = (item: ChecklistItem, props: Partial<{compact: boolean; timelineEvents: TimelineEvent[]}> = {}) => renderer.create(
    <IntlProvider locale='en'>
        <CheckedChip
            item={item}
            {...props}
        />
    </IntlProvider>,
);

const text = (component: renderer.ReactTestRenderer) => JSON.stringify(component.toJSON());

const avatarUserIds = (component: renderer.ReactTestRenderer) =>
    component.root.findAllByProps({'data-testid': 'profile'}).map((n) => n.props['data-userid']);

const has = (component: renderer.ReactTestRenderer, testid: string) =>
    component.root.findAllByProps({'data-testid': testid}).length > 0;

describe('CheckedChip', () => {
    it('renders nothing for an open, never-modified item', () => {
        const component = render(emptyChecklistItem());
        expect(component.toJSON()).toBeNull();
    });

    it('renders nothing for a checked item that was never modified (state_modified 0)', () => {
        const component = render(closedItem({state_modified: 0}));
        expect(component.toJSON()).toBeNull();
    });

    describe('checked', () => {
        it('renders a chip with no avatar and a fallback tooltip when no events are passed', () => {
            const component = render(closedItem(), {timelineEvents: []});

            expect(avatarUserIds(component)).toHaveLength(0);
            expect(text(component)).toContain('Checked off');
            expect(text(component)).not.toContain('@');
        });

        it('renders the actor avatar and activity-style tooltip when a check event matches exactly', () => {
            const component = render(closedItem(), {timelineEvents: [stateEvent('check', {subject_user_id: 'alice'})]});

            expect(avatarUserIds(component)).toEqual(['alice']);
            expect(text(component)).toContain('@alice');
            expect(text(component)).toContain('checked off');
        });

        it('disambiguates same-millisecond checks by title', () => {
            const events = [
                stateEvent('check', {id: 'e1', subject_user_id: 'alice', details: JSON.stringify({action: 'check', task: 'Other task'})}),
                stateEvent('check', {id: 'e2', subject_user_id: 'bob', details: JSON.stringify({action: 'check', task: 'Deploy'})}),
            ];
            const component = render(closedItem({title: 'Deploy'}), {timelineEvents: events});

            expect(avatarUserIds(component)).toEqual(['bob']);
        });

        it('omits the avatar (never guesses) when same-ms checks cannot be disambiguated by title', () => {
            const events = [
                stateEvent('check', {id: 'e1', subject_user_id: 'alice', details: JSON.stringify({action: 'check', task: 'X'})}),
                stateEvent('check', {id: 'e2', subject_user_id: 'bob', details: JSON.stringify({action: 'check', task: 'Y'})}),
            ];
            const component = render(closedItem({title: 'Deploy'}), {timelineEvents: events});

            expect(avatarUserIds(component)).toHaveLength(0);
            expect(text(component)).toContain('Checked off');
        });

        it('does not attribute when no event_at matches (title alone is never a sufficient link)', () => {
            const events = [stateEvent('check', {event_at: 999, subject_user_id: 'carol', details: JSON.stringify({action: 'check', task: 'Deploy'})})];
            const component = render(closedItem({title: 'Deploy'}), {timelineEvents: events});

            expect(avatarUserIds(component)).toHaveLength(0);
            expect(text(component)).toContain('Checked off');
        });

        it('shows the check icon in compact mode', () => {
            const component = render(closedItem(), {compact: true, timelineEvents: [stateEvent('check', {subject_user_id: 'alice'})]});

            expect(has(component, 'check-icon')).toBe(true);
            expect(has(component, 'uncheck-icon')).toBe(false);
            expect(avatarUserIds(component)).toEqual(['alice']);
        });

        it('shows "Checked" text and no icon in non-compact mode', () => {
            const component = render(closedItem(), {compact: false, timelineEvents: []});

            expect(has(component, 'check-icon')).toBe(false);
            expect(text(component)).toContain('Checked');
        });
    });

    describe('unchecked', () => {
        it('renders an unchecked chip for an open item that was modified', () => {
            const component = render(uncheckedItem(), {timelineEvents: [stateEvent('uncheck', {subject_user_id: 'dave'})]});

            expect(avatarUserIds(component)).toEqual(['dave']);
            expect(text(component)).toContain('@dave');
            expect(text(component)).toContain('unchecked');
        });

        it('falls back to no avatar and an Unchecked tooltip when no events are passed', () => {
            const component = render(uncheckedItem(), {timelineEvents: []});

            expect(avatarUserIds(component)).toHaveLength(0);
            expect(text(component)).toContain('Unchecked');
        });

        it('shows the uncheck icon (not the check icon) in compact mode', () => {
            const component = render(uncheckedItem(), {compact: true, timelineEvents: [stateEvent('uncheck', {subject_user_id: 'dave'})]});

            expect(has(component, 'uncheck-icon')).toBe(true);
            expect(has(component, 'check-icon')).toBe(false);
        });

        it('does not match a check event for an unchecked item', () => {
            const component = render(uncheckedItem(), {timelineEvents: [stateEvent('check', {subject_user_id: 'alice'})]});

            expect(avatarUserIds(component)).toHaveLength(0);
            expect(text(component)).toContain('Unchecked');
        });
    });
});
