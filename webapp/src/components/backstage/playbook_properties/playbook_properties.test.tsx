// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import {PropertyFieldType} from 'src/types/properties';
import {findNodeByTestId} from 'src/utils/test_helpers';

import PlaybookProperties from './playbook_properties';

const mockDispatch = jest.fn();
jest.mock('src/hooks/redux', () => ({useAppDispatch: () => mockDispatch}));
jest.mock('src/graphql/hooks', () => ({usePlaybook: () => [{id: 'pb-1', delete_at: 0}, {loading: false, error: null}]}));
jest.mock('src/hooks', () => ({usePlaybookAttributes: () => mockProperties}));
jest.mock('src/components/backstage/toast_banner', () => ({useToaster: () => ({add: jest.fn()})}));
jest.mock('src/actions', () => ({
    addPlaybookPropertyFieldAction: jest.fn(() => 'add-action'),
    deletePlaybookPropertyFieldAction: jest.fn(() => 'delete-action'),
    updatePlaybookPropertyFieldAction: jest.fn(() => 'update-action'),
    reorderPlaybookPropertyFieldsAction: jest.fn(() => 'reorder-action'),
}));

// Mock sub-components and heavy libraries to avoid deep rendering
jest.mock('./property_name_input', () => () => null);
jest.mock('./property_values_input', () => () => null);
jest.mock('./property_type_selector', () => () => null);
jest.mock('./property_dot_menu', () => () => null);
jest.mock('src/components/widgets/generic_modal', () => ({__esModule: true, default: () => null}));
jest.mock('@mattermost/compass-icons/components', () => ({
    ChevronDownCircleOutlineIcon: () => null,
    FormatListBulletedIcon: () => null,
    LinkVariantIcon: () => null,
    MenuVariantIcon: () => null,
}));
jest.mock('./empty_state', () => ({
    __esModule: true,
    default: ({buttonText, description, onButtonClick}: {buttonText?: React.ReactNode; description?: React.ReactNode; onButtonClick?: () => void}) => (
        <>
            <span data-testid='empty-state-description'>{description}</span>
            {buttonText ? (
                <button
                    data-testid='empty-state-add-button'
                    onClick={onButtonClick}
                >
                    {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                    {'add'}
                </button>
            ) : null}
        </>
    ),
}));
jest.mock('react-beautiful-dnd', () => ({
    DragDropContext: ({children}: {children: React.ReactNode}) => <>{children}</>,
    Droppable: ({children}: {children: (provided: any) => React.ReactNode}) =>
        <>{children({droppableProps: {}, innerRef: () => null, placeholder: null})}</>,
    Draggable: ({children}: {children: (provided: any) => React.ReactNode}) =>
        <>{children({draggableProps: {}, dragHandleProps: {}, innerRef: () => null})}</>,
}));
jest.mock('@tanstack/react-table', () => ({
    createColumnHelper: () => ({display: (config: any) => config}),
    flexRender: () => null,
    getCoreRowModel: () => ({}),
    useReactTable: () => ({
        getHeaderGroups: () => [],
        getRowModel: () => ({rows: []}),
    }),
}));

const mockProperty = {
    id: 'prop-1',
    name: 'Attribute 1',
    type: PropertyFieldType.Text,
    attrs: {visibility: 'when_set', sort_order: 0},
};

let mockProperties: typeof mockProperty[] = [];

const findAddButton = (tree: any) => findNodeByTestId(tree, 'add-attribute-button');
const findEmptyStateButton = (tree: any) => findNodeByTestId(tree, 'empty-state-add-button');

const render = (canEdit: boolean) =>
    renderer.create(
        <IntlProvider locale='en'>
            <PlaybookProperties
                playbookID='pb-1'
                canEdit={canEdit}
            />
        </IntlProvider>,
    );

describe('PlaybookProperties > canEdit=false', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockProperties = [];
    });

    it('disables the Add attribute button when canEdit is false', () => {
        mockProperties = [mockProperty];
        const component = render(false);
        const addButton = findAddButton(component.toJSON());
        expect(addButton).not.toBeNull();
        expect(addButton.props.disabled).toBe(true);
    });

    it('enables the Add attribute button when canEdit is true', () => {
        mockProperties = [mockProperty];
        const component = render(true);
        const addButton = findAddButton(component.toJSON());
        expect(addButton).not.toBeNull();
        expect(addButton.props.disabled).toBe(false);
    });

    it('does not dispatch when Add attribute button is clicked and canEdit is false', async () => {
        mockProperties = [mockProperty];
        const component = render(false);
        const addButton = findAddButton(component.toJSON());
        await act(async () => {
            addButton.props.onClick();
        });
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('dispatches when Add attribute button is clicked and canEdit is true', async () => {
        mockDispatch.mockResolvedValue(undefined);
        mockProperties = [mockProperty];
        const component = render(true);
        const addButton = findAddButton(component.toJSON());
        await act(async () => {
            addButton.props.onClick();
        });
        expect(mockDispatch).toHaveBeenCalled();
    });
});

describe('PlaybookProperties > canEdit=false empty state', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockProperties = [];
    });

    it('hides the add button in empty state when canEdit is false', () => {
        const component = render(false);
        expect(findEmptyStateButton(component.toJSON())).toBeNull();
    });

    it('shows the add button in empty state when canEdit is true', () => {
        const component = render(true);
        expect(findEmptyStateButton(component.toJSON())).not.toBeNull();
    });
});

describe('PlaybookProperties > empty state description', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockProperties = [];
    });

    it('shows a read-only description when canEdit is false', () => {
        const component = render(false);
        const descNode = findNodeByTestId(component.toJSON(), 'empty-state-description');
        expect(descNode).not.toBeNull();
        expect(JSON.stringify(descNode)).toContain('No custom attributes have been configured');
    });

    it('shows an actionable description when canEdit is true', () => {
        const component = render(true);
        const descNode = findNodeByTestId(component.toJSON(), 'empty-state-description');
        expect(descNode).not.toBeNull();
        expect(JSON.stringify(descNode)).toContain('Add custom attributes');
    });
});
