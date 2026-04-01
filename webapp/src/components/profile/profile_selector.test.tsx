// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import ProfileSelector, {ExtraSection} from './profile_selector';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('react-redux', () => ({
    useSelector: jest.fn(() => 'current-user-id'),
    useStore: jest.fn(() => ({getState: jest.fn(() => ({}))})),
    useDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUserId: jest.fn(),
    makeGetProfilesByIdsAndUsernames: jest.fn(() => jest.fn(() => [])),
}));

// Stub Profile and ProfileButton — they need a real MM server context we don't have here.
jest.mock('src/components/profile/profile', () => ({
    __esModule: true,
    default: ({userId}: {userId: string}) => <span data-testid={`profile-${userId}`}/>,
}));

jest.mock('src/components/profile/profile_button', () => ({
    __esModule: true,
    default: () => <button data-testid='profile-button'/>,
}));

// Stub Dropdown — render children directly so ReactSelect is reachable in the tree.
jest.mock('src/components/dropdown', () => ({
    __esModule: true,
    default: ({children, target}: {children: React.ReactNode; target: React.ReactNode}) => (
        <div data-testid='dropdown'>
            {target}
            {children}
        </div>
    ),
}));

// Stub ReactSelect — expose options via a data attribute and capture the onChange
// handler into a module-level variable so tests can invoke it directly.
//
// Note: jest.mock factories run in a restricted scope; `mockSelectOnChange` is
// prefixed with "mock" so Jest allows the reference even though it is declared
// outside the factory.
let mockSelectOnChange: ((opt: unknown, action: unknown) => void) | undefined;

jest.mock('react-select', () => ({
    __esModule: true,
    default: ({options, onChange}: {options: unknown; onChange: (opt: unknown, action: unknown) => void}) => {
        mockSelectOnChange = onChange;
        return (
            <div
                data-testid='react-select'
                data-options={JSON.stringify(options)}
            />
        );
    },
}));

// Stub styled-components FilterButton used in the default target path.
jest.mock('src/components/backstage/styles', () => ({
    FilterButton: ({children, onClick}: {children: React.ReactNode; onClick: () => void}) => (
        <button
            data-testid='filter-button'
            onClick={onClick}
        >
            {children}
        </button>
    ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal required props for ProfileSelector. */
const defaultProps = {
    placeholder: 'Select a user',
    enableEdit: true,
    getAllUsers: jest.fn().mockResolvedValue([]),
};

/** Build an ExtraSection with the given label and option values. */
const makeExtraSection = (label: string, values: string[]): ExtraSection => ({
    label,
    options: values.map((v) => ({value: v, label: v, isExtraOption: true as const})),
});

/** Render and return the parsed options array from the ReactSelect stub. */
function getRenderedOptions(component: ReturnType<typeof renderer.create>): unknown {
    const instance = component.root;
    const select = instance.findByProps({'data-testid': 'react-select'});
    return JSON.parse(select.props['data-options']);
}

/** Invoke the most recently captured ReactSelect onChange handler. */
function triggerOnChange(option: unknown, action: {action: string}) {
    if (!mockSelectOnChange) {
        throw new Error('mockSelectOnChange not set — ensure the component has been rendered');
    }
    mockSelectOnChange(option, action);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileSelector — extraSections behavior', () => {
    beforeEach(() => {
        mockSelectOnChange = undefined;
    });

    it('renders extra sections alongside user options when extraSections is provided', () => {
        const extraSections = [
            makeExtraSection('Roles', ['role-owner', 'role-creator']),
        ];

        const component = renderer.create(
            <ProfileSelector
                {...defaultProps}
                extraSections={extraSections}
            />,
        );

        const options = getRenderedOptions(component) as Array<{label: string; options: unknown[]}>;

        // Options should be grouped (array of group objects) because there are extra sections.
        expect(Array.isArray(options)).toBe(true);

        const roleGroup = options.find((g) => g.label === 'Roles');
        expect(roleGroup).toBeDefined();
        expect(roleGroup!.options).toHaveLength(2);

        const optionValues = (roleGroup!.options as Array<{value: string}>).map((o) => o.value);
        expect(optionValues).toContain('role-owner');
        expect(optionValues).toContain('role-creator');
    });

    it('calls onExtraOptionSelected (not onSelectedChange) when an extra option is selected', () => {
        const onExtraOptionSelected = jest.fn();
        const onSelectedChange = jest.fn();

        const extraSections = [makeExtraSection('Roles', ['role-owner'])];

        renderer.create(
            <ProfileSelector
                {...defaultProps}
                extraSections={extraSections}
                onExtraOptionSelected={onExtraOptionSelected}
                onSelectedChange={onSelectedChange}
            />,
        );

        const extraOption = {value: 'role-owner', label: 'role-owner', isExtraOption: true};
        renderer.act(() => {
            triggerOnChange(extraOption, {action: 'select-option'});
        });

        expect(onExtraOptionSelected).toHaveBeenCalledWith('role-owner');
        expect(onSelectedChange).not.toHaveBeenCalled();
    });

    it('calls onSelectedChange (not onExtraOptionSelected) when a regular user option is selected', () => {
        const onExtraOptionSelected = jest.fn();
        const onSelectedChange = jest.fn();

        const mockUser = {id: 'user-1', username: 'alice', first_name: 'Alice', last_name: 'Smith', nickname: ''};
        const userOption = {value: '@alice', label: 'Alice', user: mockUser};

        renderer.create(
            <ProfileSelector
                {...defaultProps}
                onExtraOptionSelected={onExtraOptionSelected}
                onSelectedChange={onSelectedChange}
            />,
        );

        renderer.act(() => {
            triggerOnChange(userOption, {action: 'select-option'});
        });

        expect(onSelectedChange).toHaveBeenCalledWith(mockUser);
        expect(onExtraOptionSelected).not.toHaveBeenCalled();
    });

    it('does not render extra sections when extraSections is undefined', () => {
        const component = renderer.create(
            <ProfileSelector
                {...defaultProps}
            />,
        );

        const options = getRenderedOptions(component);

        // Without extra sections and without userGroups, getSelectOptions returns a flat array.
        expect(Array.isArray(options)).toBe(true);

        // Flat array items should not have a nested `options` property (i.e. not grouped).
        // When there are no users the flat array is empty, so we assert it's not an array of groups.
        const isGroupedArray = Array.isArray(options) &&
            (options as unknown[]).length > 0 &&
            typeof (options as Array<{options: unknown}>)[0].options !== 'undefined';
        expect(isGroupedArray).toBe(false);
    });

    it('does not include a section in the dropdown when extraSections has a section with 0 options', () => {
        const extraSections: ExtraSection[] = [
            {label: 'EmptySection', options: []},
            makeExtraSection('NonEmpty', ['val-1']),
        ];

        const component = renderer.create(
            <ProfileSelector
                {...defaultProps}
                extraSections={extraSections}
            />,
        );

        const options = getRenderedOptions(component) as Array<{label: string; options: unknown[]}>;

        const emptyGroup = (options as Array<{label: string}>).find((g) => g.label === 'EmptySection');
        expect(emptyGroup).toBeUndefined();

        const nonEmptyGroup = (options as Array<{label: string; options: unknown[]}>).find((g) => g.label === 'NonEmpty');
        expect(nonEmptyGroup).toBeDefined();
        expect(nonEmptyGroup!.options).toHaveLength(1);
    });
});
