// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';
import {ClientError} from '@mattermost/client';

import {QuicklistGenerateResponse} from 'src/types/quicklist';
import {useQuicklistGenerate} from 'src/hooks';

import QuicklistModal, {makeModalDefinition} from './quicklist_modal';

// Mock the GenericModal to simplify testing
jest.mock('src/components/widgets/generic_modal', () => {
    return function MockGenericModal({children, isConfirmDisabled, ...props}: any) {
        return (
            <div
                data-testid='mock-generic-modal'
                data-props={JSON.stringify({...props, isConfirmDisabled})}
            >
                {children}
            </div>
        );
    };
});

// Mock the QuicklistSection component
jest.mock('src/components/quicklist/quicklist_section', () => {
    return function MockQuicklistSection({checklist}: any) {
        return (
            <div data-testid='quicklist-section'>
                <span data-testid='section-title'>{checklist.title}</span>
                <span data-testid='section-item-count'>{checklist.items.length}</span>
            </div>
        );
    };
});

// Mock the useQuicklistGenerate hook
jest.mock('src/hooks', () => ({
    useQuicklistGenerate: jest.fn(),
}));

const mockUseQuicklistGenerate = useQuicklistGenerate as jest.MockedFunction<typeof useQuicklistGenerate>;

const mockResponse: QuicklistGenerateResponse = {
    title: 'Test Quicklist Title',
    checklists: [
        {
            id: 'checklist-1',
            title: 'Design Phase',
            items: [
                {
                    id: 'item-1',
                    title: 'Task 1',
                    description: 'Description 1',
                    state: '',
                    state_modified: 0,
                    assignee_id: '',
                    assignee_modified: 0,
                    command: '',
                    command_last_run: 0,
                    due_date: 1705363200000,
                    task_actions: [],
                },
                {
                    id: 'item-2',
                    title: 'Task 2',
                    description: 'Description 2',
                    state: '',
                    state_modified: 0,
                    assignee_id: '',
                    assignee_modified: 0,
                    command: '',
                    command_last_run: 0,
                    due_date: 0,
                    task_actions: [],
                },
            ],
            items_order: ['item-1', 'item-2'],
        },
        {
            id: 'checklist-2',
            title: 'Development Phase',
            items: [
                {
                    id: 'item-3',
                    title: 'Task 3',
                    description: 'Description 3',
                    state: '',
                    state_modified: 0,
                    assignee_id: '',
                    assignee_modified: 0,
                    command: '',
                    command_last_run: 0,
                    due_date: 0,
                    task_actions: [],
                },
            ],
            items_order: ['item-3'],
        },
    ],
    thread_info: {
        truncated: false,
        truncated_count: 0,
        message_count: 15,
        participant_count: 4,
    },
};

const renderWithIntl = (component: React.ReactElement) => {
    return renderer.create(
        <IntlProvider
            locale='en'
            messages={{}}
        >
            {component}
        </IntlProvider>
    );
};

const getTreeString = (component: renderer.ReactTestRenderer) => {
    return JSON.stringify(component.toJSON());
};

describe('QuicklistModal', () => {
    const defaultProps = {
        postId: 'test-post-id',
        channelId: 'test-channel-id',
        onHide: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loading state', () => {
        beforeEach(() => {
            mockUseQuicklistGenerate.mockReturnValue({
                isLoading: true,
                data: null,
                error: null,
            });
        });

        it('renders without crashing', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            expect(component.toJSON()).toBeTruthy();
        });

        it('displays loading state', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('quicklist-loading');
            expect(treeStr).toContain('Analyzing thread...');
        });

        it('has confirm button disabled during loading', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('isConfirmDisabled');
            expect(treeStr).toMatch(/isConfirmDisabled[^}]*true/);
        });
    });

    describe('success state', () => {
        beforeEach(() => {
            mockUseQuicklistGenerate.mockReturnValue({
                isLoading: false,
                data: mockResponse,
                error: null,
            });
        });

        it('displays AI-suggested title', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('quicklist-title');
            expect(treeStr).toContain('Test Quicklist Title');
        });

        it('displays checklist sections correctly', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('quicklist-section');
            expect(treeStr).toContain('Design Phase');
            expect(treeStr).toContain('Development Phase');
        });

        it('displays thread info', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('quicklist-thread-info');
            expect(treeStr).toContain('15');
            expect(treeStr).toContain('4');
        });

        it('has confirm button enabled when checklists exist', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toMatch(/isConfirmDisabled[^}]*false/);
        });

        it('does not show truncation warning when not truncated', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).not.toContain('quicklist-truncation-warning');
        });
    });

    describe('truncation warning', () => {
        const truncatedResponse: QuicklistGenerateResponse = {
            ...mockResponse,
            thread_info: {
                truncated: true,
                truncated_count: 25,
                message_count: 50,
                participant_count: 8,
            },
        };

        beforeEach(() => {
            mockUseQuicklistGenerate.mockReturnValue({
                isLoading: false,
                data: truncatedResponse,
                error: null,
            });
        });

        it('displays truncation warning when truncated is true', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('quicklist-truncation-warning');
        });

        it('displays correct truncated message count', () => {
            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('quicklist-truncation-warning');
            expect(treeStr).toContain('25');
            expect(treeStr).toContain('messages not analyzed');
        });
    });

    describe('error state', () => {
        it('displays error message on failure', () => {
            const error = new ClientError('test-url', {
                message: 'Failed to generate checklist',
                status_code: 500,
                url: '/api/v0/quicklist/generate',
            });

            mockUseQuicklistGenerate.mockReturnValue({
                isLoading: false,
                data: null,
                error,
            });

            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('quicklist-error');
            expect(treeStr).toContain('Failed to generate checklist');
        });

        it('displays default error message when error has no message', () => {
            const error = new ClientError('test-url', {
                message: '',
                status_code: 500,
                url: '/api/v0/quicklist/generate',
            });

            mockUseQuicklistGenerate.mockReturnValue({
                isLoading: false,
                data: null,
                error,
            });

            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('quicklist-error');
            expect(treeStr).toContain('Failed to generate checklist. Please try again.');
        });

        it('has confirm button disabled on error', () => {
            const error = new ClientError('test-url', {
                message: 'Error',
                status_code: 500,
                url: '',
            });

            mockUseQuicklistGenerate.mockReturnValue({
                isLoading: false,
                data: null,
                error,
            });

            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toMatch(/isConfirmDisabled[^}]*true/);
        });
    });

    describe('empty state', () => {
        it('displays empty state when no checklists returned', () => {
            const emptyResponse: QuicklistGenerateResponse = {
                title: 'Empty Quicklist',
                checklists: [],
                thread_info: {
                    truncated: false,
                    truncated_count: 0,
                    message_count: 5,
                    participant_count: 2,
                },
            };

            mockUseQuicklistGenerate.mockReturnValue({
                isLoading: false,
                data: emptyResponse,
                error: null,
            });

            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toContain('quicklist-empty');
            expect(treeStr).toContain('No action items could be identified in this thread.');
        });

        it('has confirm button disabled when no checklists', () => {
            const emptyResponse: QuicklistGenerateResponse = {
                title: 'Empty Quicklist',
                checklists: [],
                thread_info: {
                    truncated: false,
                    truncated_count: 0,
                    message_count: 5,
                    participant_count: 2,
                },
            };

            mockUseQuicklistGenerate.mockReturnValue({
                isLoading: false,
                data: emptyResponse,
                error: null,
            });

            const component = renderWithIntl(<QuicklistModal {...defaultProps}/>);
            const treeStr = getTreeString(component);

            expect(treeStr).toMatch(/isConfirmDisabled[^}]*true/);
        });
    });
});

describe('makeModalDefinition', () => {
    it('returns correct modal definition', () => {
        // Need to reset the mock for this test since it doesn't need the hook
        mockUseQuicklistGenerate.mockReturnValue({
            isLoading: true,
            data: null,
            error: null,
        });

        const props = {
            postId: 'test-post-id',
            channelId: 'test-channel-id',
            onHide: jest.fn(),
        };

        const definition = makeModalDefinition(props);

        expect(definition.modalId).toBe('playbooks_quicklist_modal');
        expect(definition.dialogType).toBe(QuicklistModal);
        expect(definition.dialogProps).toEqual(props);
    });
});
