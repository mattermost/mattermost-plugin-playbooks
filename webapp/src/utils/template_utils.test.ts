// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PropertyField} from 'src/types/properties';

import {
    SYSTEM_TOKENS,
    buildTemplatePreview,
    extractTemplateFieldNames,
    formatSequentialID,
    resolveTemplatePreview,
} from './template_utils';

describe('template_utils', () => {
    describe('SYSTEM_TOKENS', () => {
        it('should contain SEQ, OWNER, and CREATOR', () => {
            expect(SYSTEM_TOKENS.has('SEQ')).toBe(true);
            expect(SYSTEM_TOKENS.has('OWNER')).toBe(true);
            expect(SYSTEM_TOKENS.has('CREATOR')).toBe(true);
        });

        it('should not contain unknown tokens', () => {
            expect(SYSTEM_TOKENS.has('UNKNOWN')).toBe(false);
            expect(SYSTEM_TOKENS.has('NAME')).toBe(false);
        });
    });

    describe('formatSequentialID', () => {
        it('should return empty string when runNumber is 0 and prefix is empty', () => {
            expect(formatSequentialID('', 0)).toBe('');
        });

        it('should return empty string when runNumber is 0 regardless of prefix', () => {
            expect(formatSequentialID('INC', 0)).toBe('');
        });

        it('should return zero-padded number when prefix is empty', () => {
            expect(formatSequentialID('', 3)).toBe('00003');
        });

        it('should return prefix-padded number when prefix is set', () => {
            expect(formatSequentialID('INC', 42)).toBe('INC-00042');
        });

        it('should pad single digit run number to 5 digits with prefix', () => {
            expect(formatSequentialID('INC', 1)).toBe('INC-00001');
        });

        it('should return zero-padded number for 5-digit run number without prefix', () => {
            expect(formatSequentialID('', 99999)).toBe('99999');
        });

        it('should not truncate numbers exceeding 5 digits without prefix', () => {
            expect(formatSequentialID('', 100000)).toBe('100000');
        });

        it('should not truncate numbers exceeding 5 digits with prefix', () => {
            expect(formatSequentialID('INC', 100000)).toBe('INC-100000');
        });
    });

    describe('extractTemplateFieldNames', () => {
        it('should return empty array for empty string', () => {
            expect(extractTemplateFieldNames('')).toEqual([]);
        });

        it('should return empty array for template with no tokens', () => {
            expect(extractTemplateFieldNames('Run-001')).toEqual([]);
        });

        it('should exclude system tokens (case-insensitive)', () => {
            expect(extractTemplateFieldNames('{SEQ}')).toEqual([]);
            expect(extractTemplateFieldNames('{OWNER}')).toEqual([]);
            expect(extractTemplateFieldNames('{CREATOR}')).toEqual([]);
            expect(extractTemplateFieldNames('{seq}')).toEqual([]);
            expect(extractTemplateFieldNames('{owner}')).toEqual([]);
            expect(extractTemplateFieldNames('{creator}')).toEqual([]);
        });

        it('should extract custom field names', () => {
            expect(extractTemplateFieldNames('{Project}')).toEqual(['Project']);
            expect(extractTemplateFieldNames('{Region}')).toEqual(['Region']);
        });

        it('should extract multiple custom field names', () => {
            const result = extractTemplateFieldNames('{Project}-{Region}');
            expect(result).toEqual(['Project', 'Region']);
        });

        it('should extract custom fields from mixed template with system tokens', () => {
            const result = extractTemplateFieldNames('{SEQ}-{Project}-{OWNER}');
            expect(result).toEqual(['Project']);
        });

        it('should trim whitespace inside tokens', () => {
            const result = extractTemplateFieldNames('{ Project }');
            expect(result).toEqual(['Project']);
        });

        it('should handle template with only system tokens', () => {
            const result = extractTemplateFieldNames('{SEQ}-{OWNER}-{CREATOR}');
            expect(result).toEqual([]);
        });
    });

    describe('resolveTemplatePreview', () => {
        const baseAttrs = {visibility: 'always', sort_order: 0};
        const fields = [
            {id: 'field-1', name: 'Project', type: 'text', group_id: 'g1', attrs: baseAttrs},
            {id: 'field-2', name: 'Region', type: 'select', group_id: 'g1', attrs: {...baseAttrs, options: [{id: 'opt-us', name: 'US', color: ''}, {id: 'opt-eu', name: 'EU', color: ''}]}},
            {id: 'field-3', name: 'Tags', type: 'multiselect', group_id: 'g1', attrs: {...baseAttrs, options: [{id: 'tag-a', name: 'Alpha', color: ''}, {id: 'tag-b', name: 'Beta', color: ''}]}},
            {id: 'field-4', name: 'Assignee', type: 'user', group_id: 'g1', attrs: baseAttrs},
            {id: 'field-5', name: 'Members', type: 'multiuser', group_id: 'g1', attrs: baseAttrs},
            {id: 'field-6', name: 'DueDate', type: 'date', group_id: 'g1', attrs: baseAttrs},
        ] as PropertyField[];

        it('should return template unchanged for empty string', () => {
            expect(resolveTemplatePreview('', fields, {})).toBe('');
        });

        it('should return template unchanged when no tokens match', () => {
            expect(resolveTemplatePreview('Run-001', fields, {})).toBe('Run-001');
        });

        it('should resolve SEQ to default "N"', () => {
            expect(resolveTemplatePreview('{SEQ}', fields, {})).toBe('N');
        });

        it('should resolve OWNER to default placeholder', () => {
            expect(resolveTemplatePreview('{OWNER}', fields, {})).toBe("Owner's name");
        });

        it('should resolve CREATOR to default placeholder', () => {
            expect(resolveTemplatePreview('{CREATOR}', fields, {})).toBe("Creator's name");
        });

        it('should use provided systemTokens overrides', () => {
            const result = resolveTemplatePreview('{SEQ}', fields, {}, {SEQ: 'PREFIX-42'});
            expect(result).toBe('PREFIX-42');
        });

        it('should resolve text field value', () => {
            const result = resolveTemplatePreview('{Project}', fields, {'field-1': 'Acme'});
            expect(result).toBe('Acme');
        });

        it('should leave token unchanged when field value is empty', () => {
            const result = resolveTemplatePreview('{Project}', fields, {'field-1': ''});
            expect(result).toBe('{Project}');
        });

        it('should leave token unchanged when field value is undefined', () => {
            const result = resolveTemplatePreview('{Project}', fields, {});
            expect(result).toBe('{Project}');
        });

        it('should resolve select field to option name', () => {
            const result = resolveTemplatePreview('{Region}', fields, {'field-2': 'opt-us'});
            expect(result).toBe('US');
        });

        it('should fall back to raw value for unknown select option', () => {
            const result = resolveTemplatePreview('{Region}', fields, {'field-2': 'unknown-id'});
            expect(result).toBe('unknown-id');
        });

        it('should resolve multiselect field to joined option names', () => {
            const result = resolveTemplatePreview('{Tags}', fields, {'field-3': ['tag-a', 'tag-b']});
            expect(result).toBe('Alpha, Beta');
        });

        it('should resolve user field using userMap', () => {
            const result = resolveTemplatePreview('{Assignee}', fields, {'field-4': 'user-1'}, {}, {'user-1': 'Alice'});
            expect(result).toBe('Alice');
        });

        it('should fall back to raw userId when userMap missing for user field', () => {
            const result = resolveTemplatePreview('{Assignee}', fields, {'field-4': 'user-1'});
            expect(result).toBe('user-1');
        });

        it('should resolve multiuser field to joined display names', () => {
            const userMap = {'user-1': 'Alice', 'user-2': 'Bob'};
            const result = resolveTemplatePreview('{Members}', fields, {'field-5': ['user-1', 'user-2']}, undefined, userMap);
            expect(result).toBe('Alice, Bob');
        });

        it('should resolve date field to YYYY-MM-DD format', () => {
            const result = resolveTemplatePreview('{DueDate}', fields, {'field-6': '2024-06-15T00:00:00.000Z'});
            expect(result).toBe('2024-06-15');
        });

        it('should return raw value for invalid date string', () => {
            const result = resolveTemplatePreview('{DueDate}', fields, {'field-6': 'not-a-date'});
            expect(result).toBe('not-a-date');
        });

        it('should leave token unchanged for unknown field name', () => {
            const result = resolveTemplatePreview('{Unknown}', fields, {});
            expect(result).toBe('{Unknown}');
        });

        it('should resolve multiple tokens in one template', () => {
            const result = resolveTemplatePreview('{SEQ}-{Project}', fields, {'field-1': 'Acme'});
            expect(result).toBe('N-Acme');
        });

        it('should handle case-insensitive field name matching', () => {
            const result = resolveTemplatePreview('{project}', fields, {'field-1': 'Acme'});
            expect(result).toBe('Acme');
        });
    });

    describe('buildTemplatePreview', () => {
        const fields = [
            {id: 'field-1', name: 'Project', type: 'text', group_id: 'g1', attrs: {visibility: 'always', sort_order: 0}},
        ] as PropertyField[];

        it('should resolve SEQ with prefix and run number', () => {
            const result = buildTemplatePreview('{SEQ}', fields, {}, {prefix: 'RUN', userMap: {}, nextRunNumber: 5});
            expect(result).toBe('RUN-00005');
        });

        it('should resolve SEQ with run number only when no prefix', () => {
            const result = buildTemplatePreview('{SEQ}', fields, {}, {prefix: '', userMap: {}, nextRunNumber: 3});
            expect(result).toBe('00003');
        });

        it('should resolve SEQ to prefix-N when no run number', () => {
            const result = buildTemplatePreview('{SEQ}', fields, {}, {prefix: 'RUN'});
            expect(result).toBe('RUN-N');
        });

        it('should resolve SEQ to "N" when no prefix or run number', () => {
            const result = buildTemplatePreview('{SEQ}', fields, {});
            expect(result).toBe('N');
        });

        it('should resolve OWNER from userMap', () => {
            const result = buildTemplatePreview('{OWNER}', fields, {}, {prefix: '', userMap: {'user-1': 'Alice'}, ownerUserId: 'user-1'});
            expect(result).toBe('Alice');
        });

        it('should fall back to placeholder for OWNER when userId not in userMap', () => {
            const result = buildTemplatePreview('{OWNER}', fields, {}, {prefix: '', userMap: {}, ownerUserId: 'user-unknown'});
            expect(result).toBe("Owner's name");
        });

        it('should resolve CREATOR from userMap', () => {
            const result = buildTemplatePreview('{CREATOR}', fields, {}, {prefix: '', userMap: {'user-2': 'Bob'}, creatorUserId: 'user-2'});
            expect(result).toBe('Bob');
        });

        it('should fall back to placeholder for CREATOR when no creatorUserId', () => {
            const result = buildTemplatePreview('{CREATOR}', fields, {});
            expect(result).toBe("Creator's name");
        });

        it('should resolve custom field values', () => {
            const result = buildTemplatePreview('{Project}', fields, {'field-1': 'Acme'});
            expect(result).toBe('Acme');
        });

        it('should handle complex template with multiple tokens', () => {
            const userMap = {'user-1': 'Alice'};
            const result = buildTemplatePreview('{SEQ}-{Project}-{OWNER}', fields, {'field-1': 'Acme'}, {prefix: 'RUN', userMap, ownerUserId: 'user-1', nextRunNumber: 7});
            expect(result).toBe('RUN-00007-Acme-Alice');
        });
    });
});
