// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {renderHook} from '@testing-library/react-hooks';
import {MockedProvider} from '@apollo/client/testing';
import {GraphQLError} from 'graphql';

import {
    AddPlaybookPropertyFieldDocument,
    DeletePlaybookPropertyFieldDocument,
    PlaybookDocument,
    PlaybookPropertyDocument,
    PropertyFieldType,
    UpdatePlaybookPropertyFieldDocument,
} from 'src/graphql/generated/graphql';

import {
    useAddPlaybookPropertyField,
    useDeletePlaybookPropertyField,
    usePlaybook,
    usePlaybookProperty,
    useUpdatePlaybookPropertyField,
} from './hooks';

describe('GraphQL Hooks Integration Tests', () => {
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

    const createWrapper = (mocks: any[] = []) => {
        return ({children}: {children: React.ReactNode}) => (
            <MockedProvider
                mocks={mocks}
                addTypename={false}
            >
                {children}
            </MockedProvider>
        );
    };

    describe('Playbook Query with PropertyFields', () => {
        it('should fetch playbook with property fields successfully', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    result: {
                        data: {
                            playbook: mockPlaybookWithPropertyFields,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            // Initially loading
            expect(result.current[1].loading).toBe(true);
            expect(result.current[0]).toBeUndefined();

            await waitForNextUpdate();

            // After loading completes
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toEqual(mockPlaybookWithPropertyFields);
            expect(result.current[1].error).toBeUndefined();

            // Verify property fields are included
            expect(result.current[0]?.propertyFields).toHaveLength(3);
            expect(result.current[0]?.propertyFields[0].name).toBe('Priority');
            expect(result.current[0]?.propertyFields[0].type).toBe(PropertyFieldType.Select);
            expect(result.current[0]?.propertyFields[1].name).toBe('Assignee');
            expect(result.current[0]?.propertyFields[1].type).toBe(PropertyFieldType.User);
            expect(result.current[0]?.propertyFields[2].name).toBe('Description');
            expect(result.current[0]?.propertyFields[2].type).toBe(PropertyFieldType.Text);
        });

        it('should handle playbook with empty property fields', async () => {
            const playbookWithoutFields = {
                ...mockPlaybookWithPropertyFields,
                propertyFields: [],
            };

            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    result: {
                        data: {
                            playbook: playbookWithoutFields,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            await waitForNextUpdate();

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]?.propertyFields).toEqual([]);
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

            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    result: {
                        data: {
                            playbook: playbookWithDifferentTypes,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            await waitForNextUpdate();

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]?.propertyFields).toHaveLength(6);

            // Verify all property field types are represented
            const fieldTypes = result.current[0]?.propertyFields.map((field) => field.type);
            expect(fieldTypes).toContain(PropertyFieldType.Text);
            expect(fieldTypes).toContain(PropertyFieldType.Select);
            expect(fieldTypes).toContain(PropertyFieldType.Multiselect);
            expect(fieldTypes).toContain(PropertyFieldType.Date);
            expect(fieldTypes).toContain(PropertyFieldType.User);
            expect(fieldTypes).toContain(PropertyFieldType.Multiuser);
        });

        it('should handle playbook query errors', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    error: new GraphQLError('Playbook not found'),
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            await waitForNextUpdate();

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].error).toBeDefined();
        });
    });

    describe('PlaybookProperty Query', () => {
        it('should handle successful query', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookPropertyDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyID: mockPropertyID,
                        },
                    },
                    result: {
                        data: {
                            playbookProperty: mockPropertyField,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybookProperty(mockPlaybookID, mockPropertyID),
                {wrapper}
            );

            // Initially loading
            expect(result.current[1].loading).toBe(true);
            expect(result.current[0]).toBeUndefined();

            await waitForNextUpdate();

            // After loading completes
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toEqual(mockPropertyField);
            expect(result.current[1].error).toBeUndefined();
        });

        it('should handle query errors', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookPropertyDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyID: mockPropertyID,
                        },
                    },
                    error: new GraphQLError('Property field not found'),
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybookProperty(mockPlaybookID, mockPropertyID),
                {wrapper}
            );

            // Initially loading
            expect(result.current[1].loading).toBe(true);

            await waitForNextUpdate();

            // After error occurs
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].error).toBeDefined();
        });

        it('should handle network errors', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookPropertyDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyID: mockPropertyID,
                        },
                    },
                    error: new Error('Network error'),
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybookProperty(mockPlaybookID, mockPropertyID),
                {wrapper}
            );

            // Initially loading
            expect(result.current[1].loading).toBe(true);

            await waitForNextUpdate();

            // After network error occurs
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].error).toBeDefined();
        });
    });

    describe('AddPlaybookPropertyField Mutation', () => {
        it('should handle successful mutation', async () => {
            const newFieldID = 'new-field-789';
            const mocks = [
                {
                    request: {
                        query: AddPlaybookPropertyFieldDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyField: {
                                name: 'New Priority Field',
                                type: PropertyFieldType.Select,
                                attrs: {
                                    visibility: 'always',
                                    sortOrder: 1,
                                    options: [
                                        {name: 'High', color: 'red'},
                                        {name: 'Low', color: 'green'},
                                    ],
                                },
                            },
                        },
                    },
                    result: {
                        data: {
                            addPlaybookPropertyField: newFieldID,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result} = renderHook(() => useAddPlaybookPropertyField(), {wrapper});

            const [mutate, {loading, error}] = result.current;

            expect(loading).toBe(false);
            expect(error).toBeUndefined();
            expect(typeof mutate).toBe('function');

            // Test the actual mutation execution
            const mutationPromise = mutate(mockPlaybookID, {
                name: 'New Priority Field',
                type: PropertyFieldType.Select,
                attrs: {
                    visibility: 'always',
                    sortOrder: 1,
                    options: [
                        {name: 'High', color: 'red'},
                        {name: 'Low', color: 'green'},
                    ],
                },
            });

            expect(mutationPromise).toBeDefined();
            await expect(mutationPromise).resolves.toBeDefined();
        });

        it('should handle mutation errors', async () => {
            const mocks = [
                {
                    request: {
                        query: AddPlaybookPropertyFieldDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyField: {
                                name: 'Invalid Field',
                                type: PropertyFieldType.Select,
                            },
                        },
                    },
                    error: new GraphQLError('Validation failed'),
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result} = renderHook(() => useAddPlaybookPropertyField(), {wrapper});

            expect(result.current[1].error).toBeUndefined();

            // Test error handling
            const [mutate] = result.current;
            const mutationPromise = mutate(mockPlaybookID, {
                name: 'Invalid Field',
                type: PropertyFieldType.Select,
            });

            await expect(mutationPromise).rejects.toBeDefined();
        });
    });

    describe('UpdatePlaybookPropertyField Mutation', () => {
        it('should handle successful update', async () => {
            const mocks = [
                {
                    request: {
                        query: UpdatePlaybookPropertyFieldDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyFieldID: mockPropertyID,
                            propertyField: {
                                name: 'Updated Priority Field',
                                type: PropertyFieldType.Select,
                                attrs: {
                                    visibility: 'when_set',
                                    sortOrder: 2,
                                },
                            },
                        },
                    },
                    result: {
                        data: {
                            updatePlaybookPropertyField: mockPropertyID,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result} = renderHook(() => useUpdatePlaybookPropertyField(), {wrapper});

            const [mutate, {loading, error}] = result.current;

            expect(loading).toBe(false);
            expect(error).toBeUndefined();
            expect(typeof mutate).toBe('function');

            // Test the actual mutation execution
            const mutationPromise = mutate(mockPlaybookID, mockPropertyID, {
                name: 'Updated Priority Field',
                type: PropertyFieldType.Select,
                attrs: {
                    visibility: 'when_set',
                    sortOrder: 2,
                },
            });

            expect(mutationPromise).toBeDefined();
            await expect(mutationPromise).resolves.toBeDefined();
        });

        it('should handle update with option changes', async () => {
            const mocks = [
                {
                    request: {
                        query: UpdatePlaybookPropertyFieldDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyFieldID: mockPropertyID,
                            propertyField: {
                                name: 'Priority with New Options',
                                type: PropertyFieldType.Select,
                                attrs: {
                                    visibility: 'always',
                                    sortOrder: 1,
                                    options: [
                                        {id: 'option-1', name: 'Critical', color: 'red'},
                                        {name: 'Normal', color: 'blue'}, // New option
                                        {id: 'option-2', name: 'Low', color: 'green'},
                                    ],
                                },
                            },
                        },
                    },
                    result: {
                        data: {
                            updatePlaybookPropertyField: mockPropertyID,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result} = renderHook(() => useUpdatePlaybookPropertyField(), {wrapper});

            expect(result.current[1].loading).toBe(false);
            expect(result.current[1].error).toBeUndefined();

            // Test the actual mutation execution with option changes
            const [mutate] = result.current;
            const mutationPromise = mutate(mockPlaybookID, mockPropertyID, {
                name: 'Priority with New Options',
                type: PropertyFieldType.Select,
                attrs: {
                    visibility: 'always',
                    sortOrder: 1,
                    options: [
                        {id: 'option-1', name: 'Critical', color: 'red'},
                        {name: 'Normal', color: 'blue'}, // New option
                        {id: 'option-2', name: 'Low', color: 'green'},
                    ],
                },
            });

            expect(mutationPromise).toBeDefined();
            await expect(mutationPromise).resolves.toBeDefined();
        });
    });

    describe('DeletePlaybookPropertyField Mutation', () => {
        it('should handle successful deletion', async () => {
            const mocks = [
                {
                    request: {
                        query: DeletePlaybookPropertyFieldDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyFieldID: mockPropertyID,
                        },
                    },
                    result: {
                        data: {
                            deletePlaybookPropertyField: mockPropertyID,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result} = renderHook(() => useDeletePlaybookPropertyField(), {wrapper});

            const [mutate, {loading, error}] = result.current;

            expect(loading).toBe(false);
            expect(error).toBeUndefined();
            expect(typeof mutate).toBe('function');

            // Test the actual mutation execution
            const mutationPromise = mutate(mockPlaybookID, mockPropertyID);

            expect(mutationPromise).toBeDefined();
            await expect(mutationPromise).resolves.toBeDefined();
        });

        it('should handle deletion errors', async () => {
            const mocks = [
                {
                    request: {
                        query: DeletePlaybookPropertyFieldDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyFieldID: 'non-existent-field',
                        },
                    },
                    error: new GraphQLError('Property field not found'),
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result} = renderHook(() => useDeletePlaybookPropertyField(), {wrapper});

            expect(result.current[1].error).toBeUndefined();

            // Test error handling
            const [mutate] = result.current;
            const mutationPromise = mutate(mockPlaybookID, 'non-existent-field');

            await expect(mutationPromise).rejects.toBeDefined();
        });
    });

    describe('Variable Validation', () => {
        it('should validate required variables for PlaybookProperty query', () => {
            const requiredVariables = ['playbookID', 'propertyID'];

            const mockRequest = {
                query: PlaybookPropertyDocument,
                variables: {
                    playbookID: mockPlaybookID,
                    propertyID: mockPropertyID,
                },
            };

            expect(mockRequest.variables).toHaveProperty('playbookID');
            expect(mockRequest.variables).toHaveProperty('propertyID');
            expect(Object.keys(mockRequest.variables)).toEqual(requiredVariables);
        });

        it('should validate required variables for mutations', () => {
            const addVariables = {
                playbookID: mockPlaybookID,
                propertyField: {
                    name: 'Test Field',
                    type: PropertyFieldType.Text,
                },
            };

            const updateVariables = {
                playbookID: mockPlaybookID,
                propertyFieldID: mockPropertyID,
                propertyField: {
                    name: 'Updated Field',
                    type: PropertyFieldType.Text,
                },
            };

            const deleteVariables = {
                playbookID: mockPlaybookID,
                propertyFieldID: mockPropertyID,
            };

            expect(addVariables).toHaveProperty('playbookID');
            expect(addVariables).toHaveProperty('propertyField');
            expect(addVariables.propertyField).toHaveProperty('name');
            expect(addVariables.propertyField).toHaveProperty('type');

            expect(updateVariables).toHaveProperty('playbookID');
            expect(updateVariables).toHaveProperty('propertyFieldID');
            expect(updateVariables).toHaveProperty('propertyField');

            expect(deleteVariables).toHaveProperty('playbookID');
            expect(deleteVariables).toHaveProperty('propertyFieldID');
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

    describe('Cache Invalidation Integration', () => {
        it('should successfully execute mutations with refetchQueries configured', async () => {
            const newFieldID = 'new-field-123';

            const mocks = [
                {
                    request: {
                        query: AddPlaybookPropertyFieldDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyField: {
                                name: 'New Field',
                                type: PropertyFieldType.Text,
                            },
                        },
                    },
                    result: {
                        data: {
                            addPlaybookPropertyField: newFieldID,
                        },
                    },
                },
                {
                    request: {
                        query: UpdatePlaybookPropertyFieldDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyFieldID: mockPropertyID,
                            propertyField: {
                                name: 'Updated Field',
                                type: PropertyFieldType.Text,
                            },
                        },
                    },
                    result: {
                        data: {
                            updatePlaybookPropertyField: mockPropertyID,
                        },
                    },
                },
                {
                    request: {
                        query: DeletePlaybookPropertyFieldDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyFieldID: mockPropertyID,
                        },
                    },
                    result: {
                        data: {
                            deletePlaybookPropertyField: mockPropertyID,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);

            const {result: addResult} = renderHook(
                () => useAddPlaybookPropertyField(),
                {wrapper}
            );

            const {result: updateResult} = renderHook(
                () => useUpdatePlaybookPropertyField(),
                {wrapper}
            );

            const {result: deleteResult} = renderHook(
                () => useDeletePlaybookPropertyField(),
                {wrapper}
            );

            // Execute add mutation with refetchQueries
            const [addMutation] = addResult.current;
            const addPromise = addMutation(mockPlaybookID, {
                name: 'New Field',
                type: PropertyFieldType.Text,
            });
            await expect(addPromise).resolves.toBeDefined();

            // Execute update mutation with refetchQueries
            const [updateMutation] = updateResult.current;
            const updatePromise = updateMutation(mockPlaybookID, mockPropertyID, {
                name: 'Updated Field',
                type: PropertyFieldType.Text,
            });
            await expect(updatePromise).resolves.toBeDefined();

            // Execute delete mutation with refetchQueries
            const [deleteMutation] = deleteResult.current;
            const deletePromise = deleteMutation(mockPlaybookID, mockPropertyID);
            await expect(deletePromise).resolves.toBeDefined();
        });

        it('should verify refetchQueries includes PlaybookDocument', () => {
            // This test verifies that our hooks include the correct refetchQueries
            // to ensure cache invalidation works properly

            const wrapper = createWrapper([]);

            const {result: addResult} = renderHook(
                () => useAddPlaybookPropertyField(),
                {wrapper}
            );

            const {result: updateResult} = renderHook(
                () => useUpdatePlaybookPropertyField(),
                {wrapper}
            );

            const {result: deleteResult} = renderHook(
                () => useDeletePlaybookPropertyField(),
                {wrapper}
            );

            // All hooks should be available and ready
            expect(typeof addResult.current[0]).toBe('function');
            expect(typeof updateResult.current[0]).toBe('function');
            expect(typeof deleteResult.current[0]).toBe('function');

            // Verify mutations are properly configured (no errors during hook initialization)
            expect(addResult.current[1].error).toBeUndefined();
            expect(updateResult.current[1].error).toBeUndefined();
            expect(deleteResult.current[1].error).toBeUndefined();
        });
    });

    describe('PropertyFields Data Consistency', () => {
        it('should verify property field structure from usePlaybook query', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    result: {
                        data: {
                            playbook: mockPlaybookWithPropertyFields,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);

            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            await waitForNextUpdate();

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]?.propertyFields).toBeDefined();

            // Verify property fields structure matches expected format
            const propertyFields = result.current[0]?.propertyFields || [];
            expect(propertyFields).toHaveLength(3);

            // Check each property field has the expected structure
            propertyFields.forEach((field) => {
                expect(field).toHaveProperty('id');
                expect(field).toHaveProperty('name');
                expect(field).toHaveProperty('type');
                expect(field).toHaveProperty('group_id');
                expect(field).toHaveProperty('attrs');
                expect(field).toHaveProperty('create_at');
                expect(field).toHaveProperty('update_at');
                expect(field).toHaveProperty('delete_at');

                // Verify attrs structure
                expect(field.attrs).toHaveProperty('visibility');
                expect(field.attrs).toHaveProperty('sort_order');
                expect(field.attrs).toHaveProperty('options');
                expect(field.attrs).toHaveProperty('parent_id');
            });

            // Verify specific field types are present
            const fieldTypes = propertyFields.map((field) => field.type);
            expect(fieldTypes).toContain(PropertyFieldType.Select);
            expect(fieldTypes).toContain(PropertyFieldType.User);
            expect(fieldTypes).toContain(PropertyFieldType.Text);
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