// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {emptyChecklistItem} from 'src/types/playbook';

import {mapChecklistItemToInput} from './checklist_list';

// mapChecklistItemToInput is the function that converts ChecklistItem fields
// into the GraphQL PlaybookUpdates input shape. Any field missing from this
// mapping is silently dropped from the mutation payload, causing the server to
// reset it to its zero value and breaking features that rely on it persisting.

describe('mapChecklistItemToInput', () => {
    it('maps all base fields', () => {
        const item = {
            ...emptyChecklistItem(),
            title: 'My task',
            description: 'some desc',
            command: '/echo hi',
            command_last_run: 1234,
            due_date: 5678,
            state: 'in_progress',
            state_modified: 99,
            assignee_modified: 88,
            condition_id: 'cond-1',
        };

        const result = mapChecklistItemToInput(item);

        expect(result.title).toBe('My task');
        expect(result.description).toBe('some desc');
        expect(result.command).toBe('/echo hi');
        expect(result.commandLastRun).toBe(1234);
        expect(result.dueDate).toBe(5678);
        expect(result.state).toBe('in_progress');
        expect(result.stateModified).toBe(99);
        expect(result.assigneeModified).toBe(88);
        expect(result.conditionID).toBe('cond-1');
    });

    // --- SS-4: Role-Based Task Assignment ---

    it('preserves assignee_type=owner', () => {
        const item = {...emptyChecklistItem(), assignee_type: 'owner', assignee_id: ''};
        expect(mapChecklistItemToInput(item).assigneeType).toBe('owner');
    });

    it('preserves assignee_type=creator', () => {
        const item = {...emptyChecklistItem(), assignee_type: 'creator', assignee_id: ''};
        expect(mapChecklistItemToInput(item).assigneeType).toBe('creator');
    });

    it('preserves assignee_id for specific-user assignments', () => {
        const item = {...emptyChecklistItem(), assignee_type: '', assignee_id: 'user-abc'};
        const result = mapChecklistItemToInput(item);
        expect(result.assigneeID).toBe('user-abc');
        expect(result.assigneeType).toBe('');
    });

    it('defaults assignee_type to empty string when missing', () => {
        const item = {...emptyChecklistItem()};
        expect(mapChecklistItemToInput(item).assigneeType).toBe('');
    });

    // --- SS-12: Group Task Assignment ---

    it('preserves assignee_group_id', () => {
        const item = {...emptyChecklistItem(), assignee_type: 'group', assignee_group_id: 'group-xyz'};
        const result = mapChecklistItemToInput(item);
        expect(result.assigneeGroupID).toBe('group-xyz');
        expect(result.assigneeType).toBe('group');
    });

    it('defaults assignee_group_id to empty string when not set', () => {
        const item = {...emptyChecklistItem()};
        expect(mapChecklistItemToInput(item).assigneeGroupID).toBe('');
    });

    // --- Property-User Task Assignment ---

    it('preserves assignee_type=property_user and assignee_property_field_id', () => {
        const item = {...emptyChecklistItem(), assignee_type: 'property_user', assignee_property_field_id: 'field-abc'};
        const result = mapChecklistItemToInput(item);
        expect(result.assigneeType).toBe('property_user');
        expect(result.assigneePropertyFieldID).toBe('field-abc');
    });

    it('defaults assignee_property_field_id to empty string when not set', () => {
        const item = {...emptyChecklistItem()};
        expect(mapChecklistItemToInput(item).assigneePropertyFieldID).toBe('');
    });

    // --- SS-17: Task Lockdown ---

    it('preserves restrict_completion_to_assignee=true', () => {
        const item = {...emptyChecklistItem(), restrict_completion_to_assignee: true};
        expect(mapChecklistItemToInput(item).restrictCompletionToAssignee).toBe(true);
    });

    it('preserves restrict_completion_to_assignee=false', () => {
        const item = {...emptyChecklistItem(), restrict_completion_to_assignee: false};
        expect(mapChecklistItemToInput(item).restrictCompletionToAssignee).toBe(false);
    });

    it('defaults restrict_completion_to_assignee to false when missing', () => {
        const item = {...emptyChecklistItem()};
        expect(mapChecklistItemToInput(item).restrictCompletionToAssignee).toBe(false);
    });

    // Regression: all three fields were previously omitted from this mapping,
    // causing the server to reset them on every template save through the UI.
    it('includes all three new fields in a single mapped item', () => {
        const item = {
            ...emptyChecklistItem(),
            assignee_type: 'owner',
            assignee_group_id: 'group-123',
            restrict_completion_to_assignee: true,
        };
        const result = mapChecklistItemToInput(item);
        expect(result).toMatchObject({
            assigneeType: 'owner',
            assigneeGroupID: 'group-123',
            restrictCompletionToAssignee: true,
        });
    });
});
