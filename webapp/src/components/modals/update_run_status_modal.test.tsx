// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatSequentialID} from 'src/utils/template_utils';

import {computeStatusMessagePreview} from './update_run_status_modal';

const SEQ_3 = formatSequentialID('INC', 3);

const makeRun = (overrides: Record<string, unknown> = {}) => ({
    id: 'run-1',
    name: SEQ_3,
    owner_user_id: 'owner-id',
    reporter_user_id: 'reporter-id',
    sequential_id: SEQ_3,
    run_number: 3,
    property_fields: [],
    property_values: [],
    ...overrides,
} as any);

const userMap: Record<string, string> = {
    'owner-id': 'Alice',
    'reporter-id': 'Bob',
    'user-zone-mgr': 'Charlie',
};

describe('computeStatusMessagePreview', () => {
    it('returns empty string when message has no template tokens', () => {
        expect(computeStatusMessagePreview('Everything is on track.', makeRun(), userMap)).toBe('');
    });

    it('returns empty string when {unknown} token does not match any known token or field', () => {
        expect(computeStatusMessagePreview('Update for {John}', makeRun(), userMap)).toBe('');
    });

    it('returns empty string for empty braces {}', () => {
        expect(computeStatusMessagePreview('Result: {}', makeRun(), userMap)).toBe('');
    });

    it('resolves {OWNER} to display name', () => {
        expect(computeStatusMessagePreview('Posted by {OWNER}', makeRun(), userMap))
            .toBe('Posted by Alice');
    });

    it('resolves {CREATOR} to display name', () => {
        expect(computeStatusMessagePreview('Created by {CREATOR}', makeRun(), userMap))
            .toBe('Created by Bob');
    });

    it('resolves {SEQ} to sequential_id', () => {
        expect(computeStatusMessagePreview('[{SEQ}] status update', makeRun(), userMap))
            .toBe(`[${SEQ_3}] status update`);
    });

    it('resolves {SEQ} to run_number string when sequential_id is absent', () => {
        const run = makeRun({sequential_id: '', run_number: 7});
        expect(computeStatusMessagePreview('[{SEQ}] update', run, userMap)).toBe('[7] update');
    });

    it('resolves a custom text property field by name', () => {
        const run = makeRun({
            property_fields: [{id: 'field-zone', name: 'Zone', type: 'text', attrs: {}}],
            property_values: [{id: 'pv-1', field_id: 'field-zone', value: 'Alpha', create_at: 0, update_at: 0, delete_at: 0}],
        });
        expect(computeStatusMessagePreview('{Zone} zone update', run, userMap))
            .toBe('Alpha zone update');
    });

    it('resolves a user-type property field to display name via userMap', () => {
        const run = makeRun({
            property_fields: [{id: 'field-mgr', name: 'Manager', type: 'user', attrs: {}}],
            property_values: [{id: 'pv-2', field_id: 'field-mgr', value: 'user-zone-mgr', create_at: 0, update_at: 0, delete_at: 0}],
        });
        expect(computeStatusMessagePreview('Manager: {Manager}', run, userMap))
            .toBe('Manager: Charlie');
    });

    it('leaves user-type field as raw ID when user is not in userMap', () => {
        const run = makeRun({
            property_fields: [{id: 'field-mgr', name: 'Manager', type: 'user', attrs: {}}],
            property_values: [{id: 'pv-2', field_id: 'field-mgr', value: 'unknown-user-id', create_at: 0, update_at: 0, delete_at: 0}],
        });
        const result = computeStatusMessagePreview('Manager: {Manager}', run, {});
        expect(result).toBe('Manager: unknown-user-id');
    });

    it('resolves all tokens in a combined template', () => {
        const run = makeRun({
            property_fields: [{id: 'field-zone', name: 'Zone', type: 'text', attrs: {}}],
            property_values: [{id: 'pv-1', field_id: 'field-zone', value: 'Alpha', create_at: 0, update_at: 0, delete_at: 0}],
        });
        expect(computeStatusMessagePreview('[{SEQ}] {Zone} zone update. Owner: {OWNER}. Created by: {CREATOR}.', run, userMap))
            .toBe(`[${SEQ_3}] Alpha zone update. Owner: Alice. Created by: Bob.`);
    });

    it('shows preview when message is partially resolved with unknown tokens remaining', () => {
        // {OWNER} resolves but {foo} stays — overall the message changes, so preview is shown
        expect(computeStatusMessagePreview('By {OWNER} re: {foo}', makeRun(), userMap)).toBe('By Alice re: {foo}');
    });

    it('falls back to user ID when owner is not in userMap', () => {
        expect(computeStatusMessagePreview('Owner: {OWNER}', makeRun(), {}))
            .toBe('Owner: owner-id');
    });

    it('token matching is case-insensitive for system tokens', () => {
        expect(computeStatusMessagePreview('By {owner}', makeRun(), userMap)).toBe('By Alice');
        expect(computeStatusMessagePreview('By {Owner}', makeRun(), userMap)).toBe('By Alice');
    });
});
