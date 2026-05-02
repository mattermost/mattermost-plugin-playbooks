// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {act} from 'react';
import renderer from 'react-test-renderer';

import {emptyChecklistItem} from 'src/types/playbook';

import HoverMenuDefault from './hover_menu';
import {ChecklistItem} from './checklist_item';

jest.mock('./hover_menu', () => ({
    __esModule: true,
    default: jest.fn(() => null),
    HoverMenu: 'div',
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('react-use', () => ({
    useUpdateEffect: jest.fn(),
}));

jest.mock('src/graphql/hooks', () => ({
    useUpdateRunItemTaskActions: jest.fn(() => ({updateRunTaskActions: jest.fn()})),
}));

jest.mock('src/client', () => ({
    setAssignee: jest.fn(async () => ({})),
    setRoleAssignee: jest.fn(async () => ({})),
    setPropertyUserAssignee: jest.fn(async () => ({})),
    clientEditChecklistItem: jest.fn(),
    clientAddChecklistItem: jest.fn(),
    clientSetChecklistItemCommand: jest.fn(),
    setDueDate: jest.fn(async () => ({})),
    setChecklistItemState: jest.fn(),
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: jest.fn(() => ({add: jest.fn()})),
}));

jest.mock('src/components/backstage/toast', () => ({
    ToastStyle: {Failure: 'failure'},
}));

jest.mock('src/hooks', () => ({
    useProfilesInTeam: jest.fn(() => []),
}));

jest.mock('src/components/checklists/assignee_dropdown', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('src/utils/condition_format', () => ({
    formatConditionExpr: jest.fn(() => ''),
}));

jest.mock('src/components/profile/profile_selector', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('./task_actions', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('./task_actions_modal', () => ({
    haveAtleastOneEnabledAction: jest.fn(() => false),
}));

jest.mock('./title', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('./description', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('./inputs', () => ({
    CancelSaveButtons: () => null,
    CheckBoxButton: () => null,
}));

jest.mock('./duedate', () => ({
    DueDateButton: () => null,
}));

jest.mock('./command', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('./condition_indicator', () => ({
    __esModule: true,
    default: () => null,
}));

const MockHoverMenu = HoverMenuDefault as unknown as jest.Mock;

const makeItem = (overrides = {}) => ({...emptyChecklistItem(), ...overrides});

const renderItem = (overrides = {}) => renderer.create(
    <ChecklistItem
        checklistItem={makeItem()}
        checklistNum={0}
        itemNum={0}
        dragging={false}
        readOnly={false}
        collapsibleDescription={false}
        newItem={false}
        participantUserIds={[]}
        {...overrides}
    />,
);

describe('ChecklistItem › onExtraOptionSelected', () => {
    beforeEach(() => {
        MockHoverMenu.mockClear();
    });

    it('role:owner sets assignee_type=owner and clears assignee_id and assignee_property_field_id', async () => {
        const onUpdateChecklistItem = jest.fn();
        renderItem({onUpdateChecklistItem});

        const {onExtraOptionSelected} = MockHoverMenu.mock.calls[0][0];

        await act(async () => {
            await onExtraOptionSelected('role:owner');
        });

        expect(onUpdateChecklistItem).toHaveBeenCalledWith(expect.objectContaining({
            assignee_type: 'owner',
            assignee_id: '',
            assignee_property_field_id: '',
        }));
    });

    it('role:creator sets assignee_type=creator', async () => {
        const onUpdateChecklistItem = jest.fn();
        renderItem({onUpdateChecklistItem});

        const {onExtraOptionSelected} = MockHoverMenu.mock.calls[0][0];

        await act(async () => {
            await onExtraOptionSelected('role:creator');
        });

        expect(onUpdateChecklistItem).toHaveBeenCalledWith(expect.objectContaining({
            assignee_type: 'creator',
            assignee_id: '',
            assignee_property_field_id: '',
        }));
    });

    it('property_user:field-id sets assignee_type=property_user and assignee_property_field_id', async () => {
        const onUpdateChecklistItem = jest.fn();
        renderItem({onUpdateChecklistItem});

        const {onExtraOptionSelected} = MockHoverMenu.mock.calls[0][0];

        await act(async () => {
            await onExtraOptionSelected('property_user:field-abc-123');
        });

        expect(onUpdateChecklistItem).toHaveBeenCalledWith(expect.objectContaining({
            assignee_type: 'property_user',
            assignee_property_field_id: 'field-abc-123',
            assignee_id: '',
        }));
    });
});
