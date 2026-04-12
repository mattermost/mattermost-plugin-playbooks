// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {ConditionActionDef} from 'src/types/conditions';
import {PropertyField} from 'src/types/properties';

import ConditionHeader from './condition_header';

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

jest.mock('src/components/widgets/confirmation_modal', () => ({
    useConfirmModal: () => jest.fn(),
}));

const mockGetCondition = jest.fn();
jest.mock('src/selectors', () => ({
    getCondition: (...args: any[]) => mockGetCondition(...args),
}));

jest.mock('src/hooks', () => ({
    useProxyState: (value: any, onChange: any) => [value, onChange],
}));

jest.mock('src/hooks/general', () => ({
    useProfilesInTeam: () => [],
}));

jest.mock('react-redux', () => ({
    useSelector: jest.fn((selector: any) => selector({})),
}));

jest.mock('mattermost-redux/selectors/entities/teams', () => ({
    getCurrentTeamId: () => 'team-1',
}));

jest.mock('react-select', () => {
    const MockReactSelect = (props: any) => (
        <div data-testid='mock-react-select'>{props.placeholder}</div>
    );
    return {
        __esModule: true,
        default: MockReactSelect,
    };
});

jest.mock('src/components/profile/profile_selector', () => ({
    __esModule: true,
    default: (props: any) => (
        <div
            data-testid='mock-profile-selector'
            data-user-id={props.selectedUserId}
        />
    ),
}));

jest.mock('src/components/backstage/channel_selector', () => ({
    __esModule: true,
    default: (props: any) => (
        <div
            data-testid='mock-channel-selector'
            data-channel-ids={JSON.stringify(props.channelIds)}
        />
    ),
}));

jest.mock('src/utils/condition_format', () => ({
    extractConditions: (expr: any) => {
        if (expr?.is) {
            return [{operator: 'is', fieldId: expr.is.field_id, value: expr.is.value}];
        }
        return [];
    },
    formatCondition: (cond: any, fields: any[]) => {
        const field = fields.find((f: any) => f.id === cond.fieldId);
        return {
            fieldName: field?.name || cond.fieldId,
            operator: cond.operator === 'is' ? 'is' : 'is not',
            valueNames: Array.isArray(cond.value) ? cond.value : [cond.value],
        };
    },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const mockUseSelector = (require('react-redux').useSelector) as jest.Mock;

const mockCondition = {
    id: 'cond-1',
    condition_expr: {
        is: {
            field_id: 'field-1',
            value: ['value-1'],
        },
    },
    actions: [],
};

const mockPropertyFields: PropertyField[] = [
    {
        id: 'field-1',
        name: 'Status',
        type: 'select' as const,
        attrs: {
            options: [
                {id: 'opt-1', name: 'Active'},
                {id: 'opt-2', name: 'Inactive'},
            ],
        },
    },
];

beforeEach(() => {
    mockGetCondition.mockReturnValue(mockCondition);
    mockUseSelector.mockImplementation((selector: any) => {
        if (selector === mockGetCondition) {
            return mockCondition;
        }
        return selector({});
    });
});

describe('Conditional Actions UI', () => {
    describe('actions section visibility', () => {
        it('renders Then label when onUpdateActions is provided and editing', () => {
            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-1'
                    propertyFields={mockPropertyFields}
                    onUpdateActions={jest.fn()}
                    startEditing={true}
                    checklistIndex={0}
                />,
            );

            const rendered = JSON.stringify(component.toJSON());
            expect(rendered).toContain('Then');
        });

        it('does not render Then label when onUpdateActions is not provided', () => {
            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-1'
                    propertyFields={mockPropertyFields}
                    startEditing={true}
                    checklistIndex={0}
                />,
            );

            const rendered = JSON.stringify(component.toJSON());
            expect(rendered).not.toContain('Then');
        });
    });

    describe('action rendering', () => {
        it('renders set_owner action with profile selector', () => {
            const actions: ConditionActionDef[] = [
                {type: 'set_owner', set_owner_user_id: 'user-1'},
            ];

            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-1'
                    propertyFields={mockPropertyFields}
                    onUpdateActions={jest.fn()}
                    actions={actions}
                    startEditing={true}
                    checklistIndex={0}
                />,
            );

            const instance = component.root;
            const profileSelector = instance.findAllByProps({'data-testid': 'mock-profile-selector'});
            expect(profileSelector.length).toBe(1);
            expect(profileSelector[0].props['data-user-id']).toBe('user-1');
        });

        it('renders notify_channel action with channel selector', () => {
            const actions: ConditionActionDef[] = [
                {
                    type: 'notify_channel',
                    notify_channel_ids: ['ch-1'],
                    notify_message: 'Hello',
                },
            ];

            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-1'
                    propertyFields={mockPropertyFields}
                    onUpdateActions={jest.fn()}
                    actions={actions}
                    startEditing={true}
                    checklistIndex={0}
                />,
            );

            const instance = component.root;
            const channelSelector = instance.findAllByProps({'data-testid': 'mock-channel-selector'});
            expect(channelSelector.length).toBe(1);
            expect(channelSelector[0].props['data-channel-ids']).toBe(JSON.stringify(['ch-1']));
        });

        it('renders multiple actions', () => {
            const actions: ConditionActionDef[] = [
                {type: 'set_owner', set_owner_user_id: 'user-1'},
                {
                    type: 'notify_channel',
                    notify_channel_ids: ['ch-1'],
                    notify_message: 'Alert',
                },
            ];

            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-1'
                    propertyFields={mockPropertyFields}
                    onUpdateActions={jest.fn()}
                    actions={actions}
                    startEditing={true}
                    checklistIndex={0}
                />,
            );

            const instance = component.root;
            expect(instance.findAllByProps({'data-testid': 'mock-profile-selector'}).length).toBe(1);
            expect(instance.findAllByProps({'data-testid': 'mock-channel-selector'}).length).toBe(1);
        });
    });

    describe('add action', () => {
        it('renders Add action button in edit mode with no actions', () => {
            const handleUpdateActions = jest.fn();

            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-1'
                    propertyFields={mockPropertyFields}
                    onUpdateActions={handleUpdateActions}
                    actions={[]}
                    startEditing={true}
                    checklistIndex={0}
                />,
            );

            const rendered = JSON.stringify(component.toJSON());
            expect(rendered).toContain('Add action');
        });
    });

    describe('error handling', () => {
        it('handles invalid action type without crashing', () => {
            const actions: ConditionActionDef[] = [
                {type: 'unknown_action' as any},
            ];

            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-1'
                    propertyFields={mockPropertyFields}
                    onUpdateActions={jest.fn()}
                    actions={actions}
                    startEditing={true}
                    checklistIndex={0}
                />,
            );

            expect(component.toJSON()).toBeTruthy();
        });

        it('handles set_owner action with no user selected', () => {
            const actions: ConditionActionDef[] = [
                {type: 'set_owner'},
            ];

            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-1'
                    propertyFields={mockPropertyFields}
                    onUpdateActions={jest.fn()}
                    actions={actions}
                    startEditing={true}
                    checklistIndex={0}
                />,
            );

            const rendered = JSON.stringify(component.toJSON());
            expect(rendered).toContain('Then');
        });

        it('returns null when condition is not found', () => {
            mockGetCondition.mockReturnValue(undefined);

            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-nonexistent'
                    propertyFields={mockPropertyFields}
                    onUpdateActions={jest.fn()}
                    startEditing={true}
                    checklistIndex={0}
                />,
            );

            expect(component.toJSON()).toBeNull();
        });
    });

    describe('read-only mode', () => {
        it('does not render actions editor when not editing', () => {
            const component = renderer.create(
                <ConditionHeader
                    conditionId='cond-1'
                    propertyFields={mockPropertyFields}
                    onUpdateActions={jest.fn()}
                    actions={[]}
                    startEditing={false}
                    checklistIndex={0}
                />,
            );

            const rendered = JSON.stringify(component.toJSON());
            expect(rendered).not.toContain('Then');
            expect(rendered).not.toContain('Add action');
        });
    });
});
