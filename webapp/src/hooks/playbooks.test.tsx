// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook, waitFor} from '@testing-library/react';

import {PropertyFieldType} from 'src/types/properties';

import {usePlaybook, usePlaybookProperty} from './playbooks';

const mockFetchPlaybookPropertyField = jest.fn();
const mockClientFetchPlaybook = jest.fn();
const mockIsFavoriteItem = jest.fn();
jest.mock('src/client', () => ({
    ...jest.requireActual('src/client'),
    fetchPlaybookPropertyField: (...args: unknown[]) => mockFetchPlaybookPropertyField(...args),
    clientFetchPlaybook: (...args: unknown[]) => mockClientFetchPlaybook(...args),
    isFavoriteItem: (...args: unknown[]) => mockIsFavoriteItem(...args),
}));

describe('Playbook hooks', () => {
    const mockPlaybookID = 'playbook-123';
    const mockPropertyID = 'property-456';

    const mockPropertyField = {
        id: mockPropertyID,
        name: 'Test Property',
        type: PropertyFieldType.Select,
        group_id: 'group-789',
        attrs: {
            visibility: 'always',
            sort_order: 1,
            options: [
                {id: 'option-1', name: 'High', color: 'red'},
                {id: 'option-2', name: 'Low', color: 'green'},
            ],
            parent_id: null,
        },
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
    };

    const mockPlaybookWithPropertyFields = {
        id: mockPlaybookID,
        title: 'Test Playbook',
        description: 'A test playbook with property fields',
        team_id: 'team-123',
        public: true,
        delete_at: 0,
        default_playbook_member_role: 'member',
        invited_user_ids: [],
        broadcast_channel_ids: [],
        webhook_on_creation_urls: [],
        reminder_timer_default_seconds: 3600,
        reminder_message_template: 'Default reminder',
        broadcast_enabled: false,
        webhook_on_status_update_enabled: false,
        webhook_on_status_update_urls: [],
        status_update_enabled: true,
        retrospective_enabled: true,
        retrospective_reminder_interval_seconds: 86400,
        retrospective_template: 'Default retrospective',
        default_owner_id: 'user-123',
        run_summary_template: 'Default summary',
        run_summary_template_enabled: false,
        message_on_join: 'Welcome to the playbook',
        category_name: 'Default Category',
        invite_users_enabled: true,
        default_owner_enabled: true,
        webhook_on_creation_enabled: false,
        message_on_join_enabled: true,
        categorize_channel_enabled: false,
        create_public_playbook_run: false,
        channel_name_template: 'Playbook Run - {{.Name}}',
        create_channel_member_on_new_participant: true,
        remove_channel_member_on_removed_participant: false,
        channel_id: 'channel-123',
        channel_mode: 'create_new_channel',
        is_favorite: false,
        checklists: [],
        members: [],
        metrics: [],
        propertyFields: [
            {
                id: 'prop-1',
                name: 'Priority',
                type: PropertyFieldType.Select,
                group_id: mockPlaybookID,
                attrs: {
                    visibility: 'always',
                    sort_order: 1,
                    options: [
                        {id: 'opt-1', name: 'High', color: 'red'},
                        {id: 'opt-2', name: 'Medium', color: 'yellow'},
                        {id: 'opt-3', name: 'Low', color: 'green'},
                    ],
                    parent_id: null,
                },
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
            },
            {
                id: 'prop-2',
                name: 'Assignee',
                type: PropertyFieldType.User,
                group_id: mockPlaybookID,
                attrs: {
                    visibility: 'when_set',
                    sort_order: 2,
                    options: [],
                    parent_id: null,
                },
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
            },
            {
                id: 'prop-3',
                name: 'Description',
                type: PropertyFieldType.Text,
                group_id: mockPlaybookID,
                attrs: {
                    visibility: 'always',
                    sort_order: 3,
                    options: [],
                    parent_id: null,
                },
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
            },
        ],
    };

    describe('Playbook Query with PropertyFields', () => {
        beforeEach(() => {
            mockClientFetchPlaybook.mockReset();
            mockIsFavoriteItem.mockReset();
        });

        it('should fetch playbook with property fields successfully', async () => {
            mockClientFetchPlaybook.mockResolvedValue(mockPlaybookWithPropertyFields);
            mockIsFavoriteItem.mockResolvedValue(false);

            const {result} = renderHook(() => usePlaybook(mockPlaybookID));

            // Initially loading
            expect(result.current[1].loading).toBe(true);
            expect(result.current[0]).toBeUndefined();

            await waitFor(() => {
                expect(result.current[1].loading).toBe(false);
            });

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toEqual(mockPlaybookWithPropertyFields);
            expect(result.current[1].error).toBeUndefined();
            expect(mockClientFetchPlaybook).toHaveBeenCalledWith(mockPlaybookID);
            expect(mockIsFavoriteItem).toHaveBeenCalledWith('team-123', mockPlaybookID, 'p');
        });

        it('should handle playbook with empty property fields', async () => {
            const playbookWithoutFields = {
                ...mockPlaybookWithPropertyFields,
                propertyFields: [],
            };
            mockClientFetchPlaybook.mockResolvedValue(playbookWithoutFields);
            mockIsFavoriteItem.mockResolvedValue(false);

            const {result} = renderHook(() => usePlaybook(mockPlaybookID));

            await waitFor(() => {
                expect(result.current[1].loading).toBe(false);
            });

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toEqual(playbookWithoutFields);
            expect(result.current[1].error).toBeUndefined();
        });

        it('should handle property fields with different types', async () => {
            const playbookWithDifferentTypes = {
                ...mockPlaybookWithPropertyFields,
                propertyFields: [
                    {
                        id: 'text-field',
                        name: 'Text Field',
                        type: PropertyFieldType.Text,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'always',
                            sort_order: 1,
                            options: [],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'select-field',
                        name: 'Select Field',
                        type: PropertyFieldType.Select,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'always',
                            sort_order: 2,
                            options: [
                                {id: 'opt-1', name: 'Option 1', color: 'blue'},
                            ],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'multiselect-field',
                        name: 'Multi Select Field',
                        type: PropertyFieldType.Multiselect,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'when_set',
                            sort_order: 3,
                            options: [
                                {id: 'opt-1', name: 'Tag 1', color: 'red'},
                                {id: 'opt-2', name: 'Tag 2', color: 'green'},
                            ],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'date-field',
                        name: 'Date Field',
                        type: PropertyFieldType.Date,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'always',
                            sort_order: 4,
                            options: [],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'user-field',
                        name: 'User Field',
                        type: PropertyFieldType.User,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'when_set',
                            sort_order: 5,
                            options: [],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'multiuser-field',
                        name: 'Multi User Field',
                        type: PropertyFieldType.Multiuser,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'always',
                            sort_order: 6,
                            options: [],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                ],
            };

            mockClientFetchPlaybook.mockResolvedValue(playbookWithDifferentTypes);
            mockIsFavoriteItem.mockResolvedValue(false);

            const {result} = renderHook(() => usePlaybook(mockPlaybookID));

            await waitFor(() => {
                expect(result.current[1].loading).toBe(false);
            });

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]?.propertyFields).toHaveLength(6);
            expect(result.current[1].error).toBeUndefined();
        });

        it('should handle playbook query errors', async () => {
            mockClientFetchPlaybook.mockRejectedValue(new Error('Playbook not found'));

            const {result} = renderHook(() => usePlaybook(mockPlaybookID));

            await waitFor(() => {
                expect(result.current[1].loading).toBe(false);
            });

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].error).toBeDefined();
        });

        it('keeps previous playbook mounted while refetching', async () => {
            mockClientFetchPlaybook.mockResolvedValue(mockPlaybookWithPropertyFields);
            mockIsFavoriteItem.mockResolvedValue(false);

            const {result} = renderHook(() => usePlaybook(mockPlaybookID));

            await waitFor(() => {
                expect(result.current[1].loading).toBe(false);
            });

            const updatedPlaybook = {
                ...mockPlaybookWithPropertyFields,
                title: 'Updated Title',
                invited_user_ids: ['user-2'],
            };

            let resolveFetch: (value: typeof updatedPlaybook) => void = () => undefined;
            mockClientFetchPlaybook.mockImplementation(() => new Promise((resolve) => {
                resolveFetch = resolve;
            }));

            act(() => {
                result.current[1].refetch();
            });

            await waitFor(() => {
                expect(mockClientFetchPlaybook).toHaveBeenCalledTimes(2);
            });

            // Prior data stays visible; loading must not flip true (editor stays mounted).
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toEqual(mockPlaybookWithPropertyFields);

            await act(async () => {
                resolveFetch(updatedPlaybook);
            });

            await waitFor(() => {
                expect(result.current[0]?.title).toBe('Updated Title');
            });
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]?.invited_user_ids).toEqual(['user-2']);
        });
    });

    describe('usePlaybookProperty REST', () => {
        beforeEach(() => {
            mockFetchPlaybookPropertyField.mockReset();
        });

        it('should handle successful fetch', async () => {
            mockFetchPlaybookPropertyField.mockResolvedValue(mockPropertyField as any);

            const {result} = renderHook(
                () => usePlaybookProperty(mockPlaybookID, mockPropertyID),
            );

            expect(result.current[1].loading).toBe(true);
            expect(result.current[0]).toBeUndefined();

            await waitFor(() => {
                expect(result.current[1].loading).toBe(false);
            });

            expect(result.current[0]).toEqual(mockPropertyField);
            expect(result.current[1].error).toBeUndefined();
        });

        it('should handle missing property', async () => {
            mockFetchPlaybookPropertyField.mockResolvedValue(undefined);

            const {result} = renderHook(
                () => usePlaybookProperty(mockPlaybookID, mockPropertyID),
            );

            await waitFor(() => {
                expect(result.current[1].loading).toBe(false);
            });

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].error).toBeDefined();
        });

        it('should handle network errors', async () => {
            mockFetchPlaybookPropertyField.mockRejectedValue(new Error('Network error'));

            const {result} = renderHook(
                () => usePlaybookProperty(mockPlaybookID, mockPropertyID),
            );

            await waitFor(() => {
                expect(result.current[1].loading).toBe(false);
            });

            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].error).toBeDefined();
        });
    });

    describe('Type Consistency', () => {
        it('should maintain type consistency across operations', () => {
            const fieldInput = {
                name: 'Consistent Field',
                type: PropertyFieldType.Select,
                attrs: {
                    visibility: 'always' as const,
                    sortOrder: 1,
                    options: [
                        {name: 'Option 1', color: 'red'},
                        {name: 'Option 2', color: 'blue'},
                    ],
                },
            };

            // This input should be valid for both add and update operations
            const addVariables = {
                playbookID: mockPlaybookID,
                propertyField: fieldInput,
            };

            const updateVariables = {
                playbookID: mockPlaybookID,
                propertyFieldID: mockPropertyID,
                propertyField: fieldInput,
            };

            expect(addVariables.propertyField.type).toBe(updateVariables.propertyField.type);
            expect(addVariables.propertyField.name).toBe(updateVariables.propertyField.name);
            expect(addVariables.propertyField.attrs?.options).toHaveLength(2);
            expect(updateVariables.propertyField.attrs?.options).toHaveLength(2);
        });
    });

    describe('PropertyFields Data Consistency', () => {
        it('should verify property field structure from usePlaybook query', async () => {
            mockClientFetchPlaybook.mockResolvedValue(mockPlaybookWithPropertyFields);
            mockIsFavoriteItem.mockResolvedValue(false);

            const {result} = renderHook(() => usePlaybook(mockPlaybookID));

            await waitFor(() => {
                expect(result.current[1].loading).toBe(false);
            });

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]?.propertyFields?.[0]?.name).toBe('Priority');
        });

        it('should verify property field matches expected schema', () => {
            // Test that our mock data matches the expected GraphQL schema structure
            const sampleField = mockPlaybookWithPropertyFields.propertyFields[0];

            // Required fields from PropertyField GraphQL type
            expect(sampleField).toHaveProperty('id', expect.any(String));
            expect(sampleField).toHaveProperty('name', expect.any(String));
            expect(sampleField).toHaveProperty('type');
            expect(sampleField).toHaveProperty('group_id', expect.any(String));
            expect(sampleField).toHaveProperty('attrs');
            expect(sampleField).toHaveProperty('create_at', expect.any(Number));
            expect(sampleField).toHaveProperty('update_at', expect.any(Number));
            expect(sampleField).toHaveProperty('delete_at', expect.any(Number));

            // PropertyFieldAttrs structure
            expect(sampleField.attrs).toHaveProperty('visibility', expect.any(String));
            expect(sampleField.attrs).toHaveProperty('sort_order', expect.any(Number));
            expect(sampleField.attrs).toHaveProperty('options', expect.any(Array));

            // Verify option structure for select fields
            if (sampleField.type === PropertyFieldType.Select && sampleField.attrs.options.length > 0) {
                const option = sampleField.attrs.options[0];
                expect(option).toHaveProperty('id', expect.any(String));
                expect(option).toHaveProperty('name', expect.any(String));
                expect(option).toHaveProperty('color', expect.any(String));
            }
        });
    });
});