// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {ChecklistItemState, emptyChecklistItem} from 'src/types/playbook';
import {useIsSystemAdmin} from 'src/hooks';

import TaskLockdownIcon from './task_lockdown_icon';
import TaskLockdownCheckbox from './task_lockdown_checkbox';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/components/widgets/tooltip', () => ({
    __esModule: true,
    default: ({children, content}: any) => (
        <div data-tooltip={content}>{children}</div>
    ),
}));

jest.mock('src/hooks', () => ({
    useIsSystemAdmin: jest.fn(() => false),
}));

jest.mock('react-redux', () => ({
    useSelector: jest.fn(() => []),
    useDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('mattermost-redux/selectors/entities/groups', () => ({
    getMyGroupIds: jest.fn(),
}));

jest.mock('mattermost-redux/actions/groups', () => ({
    getGroupsByUserId: jest.fn(() => ({type: 'MOCK_GET_GROUPS_BY_USER_ID'})),
}));

const mockUseIsSystemAdmin = useIsSystemAdmin as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const mockUseSelector = (require('react-redux').useSelector) as jest.Mock;

const makeChecklistItem = (overrides = {}) => ({
    ...emptyChecklistItem(),
    ...overrides,
});

describe('TaskLockdownIcon (template editor)', () => {
    it('renders lock icon toggle for a task item', () => {
        const item = makeChecklistItem({restrict_completion_to_assignee: false});
        const onChange = jest.fn();

        const component = renderer.create(
            <TaskLockdownIcon
                item={item}
                onChange={onChange}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
    });

    it('reflects unlocked state when restrict_completion_to_assignee is false', () => {
        const item = makeChecklistItem({restrict_completion_to_assignee: false});
        const onChange = jest.fn();

        const component = renderer.create(
            <TaskLockdownIcon
                item={item}
                onChange={onChange}
            />,
        );

        const instance = component.root;
        const lockIcon = instance.findByProps({'data-testid': 'lock-icon'});
        expect(lockIcon.props['data-locked']).toBe(false);
    });

    it('reflects locked state when restrict_completion_to_assignee is true', () => {
        const item = makeChecklistItem({restrict_completion_to_assignee: true});
        const onChange = jest.fn();

        const component = renderer.create(
            <TaskLockdownIcon
                item={item}
                onChange={onChange}
            />,
        );

        const instance = component.root;
        const lockIcon = instance.findByProps({'data-testid': 'lock-icon'});
        expect(lockIcon.props['data-locked']).toBe(true);
    });

    it('calls onChange with restrict_completion_to_assignee=true when toggling from unlocked', () => {
        const item = makeChecklistItem({restrict_completion_to_assignee: false});
        const onChange = jest.fn();

        const component = renderer.create(
            <TaskLockdownIcon
                item={item}
                onChange={onChange}
            />,
        );

        const instance = component.root;
        const lockIcon = instance.findByProps({'data-testid': 'lock-icon'});
        lockIcon.props.onClick();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({
            ...item,
            restrict_completion_to_assignee: true,
        });
    });

    it('calls onChange with restrict_completion_to_assignee=false when toggling from locked', () => {
        const item = makeChecklistItem({restrict_completion_to_assignee: true});
        const onChange = jest.fn();

        const component = renderer.create(
            <TaskLockdownIcon
                item={item}
                onChange={onChange}
            />,
        );

        const instance = component.root;
        const lockIcon = instance.findByProps({'data-testid': 'lock-icon'});
        lockIcon.props.onClick();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({
            ...item,
            restrict_completion_to_assignee: false,
        });
    });
});

describe('TaskLockdownCheckbox (run view)', () => {
    const CURRENT_USER_ID = 'user-current';
    const ASSIGNEE_USER_ID = 'user-assignee';
    const OWNER_USER_ID = 'user-owner';
    const CREATOR_USER_ID = 'user-creator';

    beforeEach(() => {
        mockUseIsSystemAdmin.mockReturnValue(false);
        mockUseSelector.mockReturnValue([]);
    });

    it('shows lock indicator on restricted task', () => {
        const item = makeChecklistItem({
            assignee_id: ASSIGNEE_USER_ID,
            restrict_completion_to_assignee: true,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const lockIndicators = instance.findAll(
            (node) => node.props['data-testid'] === 'lock-indicator',
        );
        expect(lockIndicators.length).toBeGreaterThan(0);
    });

    it('does not show lock indicator on unrestricted task', () => {
        const item = makeChecklistItem({
            assignee_id: ASSIGNEE_USER_ID,
            restrict_completion_to_assignee: false,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const lockIndicators = instance.findAll(
            (node) => node.props['data-testid'] === 'lock-indicator',
        );
        expect(lockIndicators.length).toBe(0);
    });

    it('disables checkbox for non-permitted user on restricted task', () => {
        const item = makeChecklistItem({
            assignee_id: ASSIGNEE_USER_ID,
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        // CURRENT_USER_ID is neither assignee nor owner
        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(true);
    });

    it('shows tooltip with "can only be completed by" message for non-permitted user', () => {
        const item = makeChecklistItem({
            assignee_id: ASSIGNEE_USER_ID,
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                assigneeName='Jane Doe'
                onChange={jest.fn()}
                readOnly={false}
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        const rendered = JSON.stringify(tree);
        expect(rendered).toContain('can only be completed by');
        expect(rendered).toContain('Jane Doe');
    });

    it('enables checkbox for the assigned user', () => {
        const item = makeChecklistItem({
            assignee_id: CURRENT_USER_ID,
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(false);
    });

    it('disables checkbox for the run owner when task is assigned to a specific user', () => {
        const item = makeChecklistItem({
            assignee_id: ASSIGNEE_USER_ID,
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        // Run owner is NOT the assignee — backend only allows the specific assigned user
        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={OWNER_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(true);
    });

    it('enables checkbox for the run owner on a task with assignee_type="owner"', () => {
        const item = makeChecklistItem({
            assignee_type: 'owner',
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={OWNER_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(false);
    });

    it('disables checkbox for non-owner on a task with assignee_type="owner"', () => {
        const item = makeChecklistItem({
            assignee_type: 'owner',
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(true);
    });

    it('lock indicator is visible even when the current user is the permitted owner', () => {
        // The lock icon is a permanent indicator of restriction — it does NOT disappear
        // for the permitted user. This mirrors the corrected demo.sh wording:
        // "still shows the lock icon — but the checkbox is active".
        const item = makeChecklistItem({
            assignee_type: 'owner',
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={OWNER_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;

        // Lock indicator must still be present for the owner
        const lockIndicators = instance.findAll(
            (node) => node.props['data-testid'] === 'lock-indicator',
        );
        expect(lockIndicators.length).toBeGreaterThan(0);

        // Checkbox must be enabled (owner is permitted)
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(false);
    });

    it('enables checkbox for run creator on a task with assignee_type="creator"', () => {
        const item = makeChecklistItem({
            assignee_type: 'creator',
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CREATOR_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(false);
    });

    it('disables checkbox for non-creator on a task with assignee_type="creator"', () => {
        const item = makeChecklistItem({
            assignee_type: 'creator',
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(true);
    });

    it('disables checkbox for non-group-member on a task with assignee_type="group"', () => {
        // Current user is NOT in group-123
        mockUseSelector.mockReturnValue([]);

        const item = makeChecklistItem({
            assignee_type: 'group',
            assignee_group_id: 'group-123',
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(true);
    });

    it('enables checkbox for group member on a task with assignee_type="group"', () => {
        // Current user IS in group-123
        mockUseSelector.mockReturnValue(['group-123']);

        const item = makeChecklistItem({
            assignee_type: 'group',
            assignee_group_id: 'group-123',
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(false);
    });

    it('enables checkbox for system admin (bypass)', () => {
        mockUseIsSystemAdmin.mockReturnValue(true);

        const item = makeChecklistItem({
            assignee_id: ASSIGNEE_USER_ID,
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId='user-sysadmin'
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(false);
    });

    it('enables checkbox for everyone when task is locked but has no assignee', () => {
        const item = makeChecklistItem({
            assignee_id: '',
            restrict_completion_to_assignee: true,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(false);
    });

    it('enables checkbox for everyone when restrict_completion_to_assignee is false', () => {
        const item = makeChecklistItem({
            assignee_id: ASSIGNEE_USER_ID,
            restrict_completion_to_assignee: false,
            state: ChecklistItemState.Open,
        });

        const component = renderer.create(
            <TaskLockdownCheckbox
                item={item}
                currentUserId={CURRENT_USER_ID}
                runOwnerId={OWNER_USER_ID}
                runCreatorId={CREATOR_USER_ID}
                onChange={jest.fn()}
                readOnly={false}
            />,
        );

        const instance = component.root;
        const checkbox = instance.findByProps({'data-testid': 'task-checkbox'});
        expect(checkbox.props.disabled).toBe(false);
    });
});
