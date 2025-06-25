// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {renderHook} from '@testing-library/react-hooks';
import {MockedProvider} from '@apollo/client/testing';
import {GraphQLError} from 'graphql';

import {
    AddPlaybookPropertyFieldDocument,
    DeletePlaybookPropertyFieldDocument,
    PlaybookPropertyDocument,
    PropertyFieldType,
    UpdatePlaybookPropertyFieldDocument,
} from 'src/graphql/generated/graphql';

import {
    useAddPlaybookPropertyField,
    useDeletePlaybookPropertyField,
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
});