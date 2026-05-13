// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';

import {emptyChecklistItem} from 'src/types/playbook';

import ChecklistList from './checklist_list';

// --- Mocks ---

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('react-beautiful-dnd', () => ({
    DragDropContext: ({children}: any) => children,
    Droppable: ({children}: any) => children({droppableProps: {}, innerRef: jest.fn(), placeholder: null}, {}),
    Draggable: ({children}: any) => children({draggableProps: {style: {}}, dragHandleProps: {}, innerRef: jest.fn()}, {isDragging: false}),
}));

jest.mock('@floating-ui/react', () => ({
    FloatingPortal: ({children}: any) => children,
}));

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('src/graphql/hooks', () => ({
    useUpdatePlaybook: jest.fn(() => jest.fn()),
}));

const mockUsePlaybookAttributes = jest.fn();
jest.mock('src/hooks', () => ({
    usePlaybookAttributes: (...args: any[]) => mockUsePlaybookAttributes(...args),
    useProxyState: jest.fn((val: any) => [val, jest.fn()]),
}));

jest.mock('src/hooks/bulk_actions', () => ({
    useBulkActions: jest.fn(() => ({
        selectedItems: new Map(),
        selectedItemKeysSet: new Set(),
        effectiveBulkMode: false,
        onItemSelect: jest.fn(),
        handleBulkAssign: jest.fn(),
        handleBulkDueDate: jest.fn(),
        handleBulkDelete: jest.fn(),
        handleBulkAddToCondition: jest.fn(),
        clearSelection: jest.fn(),
    })),
}));

jest.mock('src/hooks/conditions', () => ({
    usePlaybookConditions: jest.fn(() => ({conditions: [], createCondition: jest.fn()})),
}));

jest.mock('src/actions', () => ({
    conditionCreated: jest.fn(),
    conditionDeleted: jest.fn(),
    conditionUpdated: jest.fn(),
    playbookRunUpdated: jest.fn(),
}));

jest.mock('src/client', () => ({
    clientAddChecklist: jest.fn(),
    clientDeleteChecklist: jest.fn(),
    clientMoveChecklist: jest.fn(),
    clientMoveChecklistItem: jest.fn(),
    deletePlaybookCondition: jest.fn(),
    updatePlaybookCondition: jest.fn(),
}));

jest.mock('src/utils', () => ({
    getDistinctAssignees: jest.fn(() => []),
}));

jest.mock('./collapsible_checklist', () => ({
    __esModule: true,
    default: ({children}: any) => <div>{children}</div>,
    ChecklistInputComponent: () => null,
    TitleHelpTextWrapper: () => null,
}));

jest.mock('./multi_select_action_bar', () => ({__esModule: true, default: () => null}));

jest.mock('src/components/checklist_item/checklist_item', () => ({
    ButtonsFormat: {Compact: 'compact'},
}));

jest.mock('src/graphql/generated/graphql', () => ({
    PlaybookRunType: {ChannelChecklist: 'channel_checklist'},
    RunStatus: {Finished: 'Finished', InProgress: 'InProgress'},
}));

let capturedProps: any = null;
jest.mock('./generic_checklist', () => ({
    __esModule: true,
    default: (props: any) => {
        capturedProps = props;
        return null;
    },
    generateKeys: (titles: string[]) => titles.map((_, i) => String(i)),
}));

// --- Fixtures ---

const userField = {
    id: 'field-user-1',
    name: 'Manager',
    type: 'user',
    target_id: 'pb-1',
    target_type: 'playbook' as const,
    attrs: {visibility: 'public' as any, sort_order: 0, options: null},
    create_at: 0,
    update_at: 0,
    delete_at: 0,
};

const makeRun = (overrides = {}) => ({
    id: 'run-1',
    playbook_id: 'pb-1',
    current_status: 'InProgress',
    checklists: [{title: 'Stage 1', items: [emptyChecklistItem()]}],
    property_fields: undefined,
    ...overrides,
} as any);

const makePlaybook = (overrides = {}) => ({
    id: 'pb-1',
    delete_at: 0,
    checklists: [{title: 'Stage 1', items: [emptyChecklistItem()]}],
    ...overrides,
} as any);

const renderList = (props: any = {}) =>
    renderer.create(
        <ChecklistList
            isReadOnly={false}
            checklistsCollapseState={{}}
            onChecklistCollapsedStateChange={jest.fn()}
            onEveryChecklistCollapsedStateChange={jest.fn()}
            {...props}
        />,
    );

// --- Tests ---

describe('ChecklistList propertyFields resolution', () => {
    beforeEach(() => {
        capturedProps = null;
        jest.clearAllMocks();
    });

    it('run mode with no run property_fields: uses playbookRun.playbook_id to fetch and passes result to GenericChecklist', () => {
        mockUsePlaybookAttributes.mockReturnValue([userField]);

        renderList({playbookRun: makeRun()});

        expect(mockUsePlaybookAttributes).toHaveBeenCalledWith('pb-1');
        expect(capturedProps?.propertyFields).toEqual([userField]);
    });

    it('run mode with run property_fields present: run-level fields take precedence over fetched playbook fields', () => {
        const runLevelField = {...userField, id: 'run-field-1'};
        const differentField = {...userField, id: 'playbook-field-99'};
        mockUsePlaybookAttributes.mockReturnValue([differentField]);

        renderList({playbookRun: makeRun({property_fields: [runLevelField]})});

        expect(capturedProps?.propertyFields).toEqual([runLevelField]);
    });

    it('template mode: uses playbook.id to fetch and passes result to GenericChecklist', () => {
        mockUsePlaybookAttributes.mockReturnValue([userField]);

        renderList({playbook: makePlaybook()});

        expect(mockUsePlaybookAttributes).toHaveBeenCalledWith('pb-1');
        expect(capturedProps?.propertyFields).toEqual([userField]);
    });
});
