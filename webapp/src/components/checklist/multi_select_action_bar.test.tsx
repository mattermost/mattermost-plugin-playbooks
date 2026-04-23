// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import MultiSelectActionBar from './multi_select_action_bar';

// --- Mocks ---

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
        FormattedMessage: ({defaultMessage}: {defaultMessage: string}) => <span>{defaultMessage}</span>,
    };
});

// Mock the heavy sub-components so we can keep component tests narrow and fast
jest.mock('src/hooks', () => ({
    useProfilesInTeam: jest.fn(() => []),
}));

jest.mock('src/components/profile/profile_selector', () => ({
    __esModule: true,
    default: ({placeholder}: {placeholder: React.ReactNode}) => (
        <div data-testid='profile-selector'>{placeholder}</div>
    ),
}));

jest.mock('src/components/datetime_selector', () => ({
    __esModule: true,
    default: ({placeholder}: {placeholder: React.ReactNode}) => (
        <div data-testid='datetime-selector'>{placeholder}</div>
    ),
}));

jest.mock('src/components/datetime_input', () => ({
    Mode: {DateTimeValue: 'datetime', DurationValue: 'duration'},
    useMakeOption: jest.fn(() => jest.fn((v: any) => ({value: v, label: String(v)}))),
}));

jest.mock('src/components/widgets/confirmation_modal', () => ({
    useConfirmModal: jest.fn(() => jest.fn()),
}));

jest.mock('src/utils/condition_format', () => ({
    formatConditionExpr: jest.fn(() => 'Mocked condition label'),
}));

// styled-components needs no special mocking — it works with jsdom

// --- Helpers ---

const defaultProps = {
    selectedCount: 1,
    participantUserIds: [],
    onClearSelection: jest.fn(),
    onBulkAssign: jest.fn(),
    onBulkDueDate: jest.fn(),
    onBulkDelete: jest.fn(),
};

// --- Tests ---

describe('MultiSelectActionBar', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns null when selectedCount is 0', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={0}
            />,
        );
        expect(component.toJSON()).toBeNull();
    });

    it('renders the action bar when selectedCount > 0', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={3}
            />,
        );
        expect(component.toJSON()).toBeTruthy();
    });

    it('renders the data-testid attribute on the container', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={2}
            />,
        );
        const tree = component.toJSON();
        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree)) {
            expect(tree.props['data-testid']).toBe('multi-select-action-bar');
        }
    });

    it('shows singular task text for selectedCount = 1', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={1}
            />,
        );
        const output = JSON.stringify(component.toJSON());
        expect(output).toContain('1');
        expect(output).toMatch(/task/i);
    });

    it('shows plural tasks text for selectedCount > 1', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={5}
            />,
        );
        const output = JSON.stringify(component.toJSON());
        expect(output).toContain('5');
        expect(output).toMatch(/tasks/i);
    });

    it('delete button has aria-label "Delete selected tasks"', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={1}
            />,
        );

        // Walk the rendered tree to find the button with the expected aria-label
        const findAriaLabel = (node: any): string | undefined => {
            if (!node) {
                return undefined;
            }
            if (Array.isArray(node)) {
                for (const child of node) {
                    const found = findAriaLabel(child);
                    if (found) {
                        return found;
                    }
                }
                return undefined;
            }
            if (typeof node !== 'object') {
                return undefined;
            }
            if (node.props?.['aria-label'] === 'Delete selected tasks') {
                return node.props['aria-label'];
            }
            return findAriaLabel(node.children);
        };

        const found = findAriaLabel(component.toJSON());
        expect(found).toBe('Delete selected tasks');
    });

    it('clear button has aria-label "Clear selection"', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={1}
            />,
        );

        const findAriaLabel = (node: any): string | undefined => {
            if (!node) {
                return undefined;
            }
            if (Array.isArray(node)) {
                for (const child of node) {
                    const found = findAriaLabel(child);
                    if (found) {
                        return found;
                    }
                }
                return undefined;
            }
            if (typeof node !== 'object') {
                return undefined;
            }
            if (node.props?.['aria-label'] === 'Clear selection') {
                return node.props['aria-label'];
            }
            return findAriaLabel(node.children);
        };

        const found = findAriaLabel(component.toJSON());
        expect(found).toBe('Clear selection');
    });

    it('clicking the clear button calls onClearSelection', () => {
        const onClearSelection = jest.fn();
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={2}
                onClearSelection={onClearSelection}
            />,
        );

        const findClearButton = (node: any): any => {
            if (!node) {
                return null;
            }
            if (Array.isArray(node)) {
                for (const child of node) {
                    const found = findClearButton(child);
                    if (found) {
                        return found;
                    }
                }
                return null;
            }
            if (typeof node !== 'object') {
                return null;
            }
            if (node.props?.['aria-label'] === 'Clear selection') {
                return node;
            }
            return findClearButton(node.children);
        };

        const tree = component.toJSON();
        const clearButton = findClearButton(tree);
        expect(clearButton).not.toBeNull();

        act(() => {
            clearButton.props.onClick();
        });

        expect(onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('does not render conditions button when no availableConditions provided', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={1}
            />,
        );
        const output = JSON.stringify(component.toJSON());
        expect(output).not.toContain('Add to condition');
    });

    it('does not render conditions button when onBulkAddToCondition is not provided', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={1}
                availableConditions={[{id: 'cond-1', condition_expr: null} as any]}
            />,
        );
        const output = JSON.stringify(component.toJSON());
        expect(output).not.toContain('Add to condition');
    });

    it('renders conditions button when both availableConditions and onBulkAddToCondition are provided', () => {
        const component = renderer.create(
            <MultiSelectActionBar
                {...defaultProps}
                selectedCount={1}
                availableConditions={[{id: 'cond-1', condition_expr: null} as any]}
                onBulkAddToCondition={jest.fn()}
            />,
        );
        const output = JSON.stringify(component.toJSON());
        expect(output).toContain('Add to condition');
    });
});
