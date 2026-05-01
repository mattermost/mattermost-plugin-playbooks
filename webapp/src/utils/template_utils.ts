// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// KEEP IN SYNC with server/app/template_engine.go (same token syntax, system tokens, and per-type formatting rules).

import {PropertyField, PropertyFieldType} from 'src/types/properties';

export type TemplatePropertyField = PropertyField;

// System token names recognized by the template engine (case-insensitive)
export const SYSTEM_TOKENS = new Set(['SEQ', 'OWNER', 'CREATOR']);

const DEFAULT_OWNER_TOKEN = "Owner's name";
const DEFAULT_CREATOR_TOKEN = "Creator's name";

// Minimum millisecond epoch value used to distinguish epoch-ms timestamps from
// compact YYYYMMDD integers (e.g. 20250101). Values below this threshold are
// treated as non-epoch integers. 1e12 ms ≈ Sep 9, 2001.
const EPOCH_MS_MIN = 1_000_000_000_000;

/**
 * Mirrors server/app.FormatSequentialID.
 * Returns empty string for runNumber === 0 (standalone / pre-feature runs).
 */
export function formatSequentialID(prefix: string, runNumber: number): string {
    if (runNumber === 0) {
        return '';
    }
    const padded = String(runNumber).padStart(5, '0');
    return prefix ? `${prefix}-${padded}` : padded;
}

// Extract field names referenced in a template (excluding system tokens)
export function extractTemplateFieldNames(template: string): string[] {
    const names: string[] = [];
    const re = /\{([^}]+)\}/g;
    let match;
    while ((match = re.exec(template)) !== null) {
        const name = match[1].trim();
        if (!SYSTEM_TOKENS.has(name.toUpperCase())) {
            names.push(name);
        }
    }
    return names;
}

export type BuildTemplatePreviewOptions = {
    prefix?: string;
    userMap?: Record<string, string>;
    ownerUserId?: string;
    creatorUserId?: string;
    nextRunNumber?: number;
    ownerFallback?: string;
    creatorFallback?: string;
};

// Build a template preview with standard system token substitution.
// SEQ renders as "<prefix>-<N>" when both are set, otherwise falls back to
// "<prefix>-N" or just "N".
// OWNER and CREATOR resolve to the display name from userMap when ownerUserId/creatorUserId are
// provided; otherwise they fall back to ownerFallback / creatorFallback (callers should pass
// a localized string from formatMessage; defaults to English for non-React contexts).
export function buildTemplatePreview(
    template: string,
    fields: TemplatePropertyField[],
    values: Record<string, unknown>,
    options: BuildTemplatePreviewOptions = {},
): string {
    const {prefix, userMap, ownerUserId, creatorUserId, nextRunNumber, ownerFallback, creatorFallback} = options;
    const ownerName = (ownerUserId && userMap?.[ownerUserId]) || ownerFallback || DEFAULT_OWNER_TOKEN;
    const creatorName = (creatorUserId && userMap?.[creatorUserId]) || creatorFallback || DEFAULT_CREATOR_TOKEN;
    let seqValue: string;
    if (nextRunNumber == null || nextRunNumber === 0) {
        seqValue = prefix ? `${prefix}-N` : 'N';
    } else {
        seqValue = formatSequentialID(prefix ?? '', nextRunNumber);
    }
    return resolveTemplatePreview(template, fields, values, {
        SEQ: seqValue,
        OWNER: ownerName,
        CREATOR: creatorName,
    }, userMap);
}

// Resolve a template string client-side for preview purposes.
// System tokens: {SEQ} → "N", {OWNER} → ownerFallback, {CREATOR} → creatorFallback.
// Custom systemTokens parameter allows callers to provide display values (takes precedence).
// ownerFallback / creatorFallback should be a localized string from formatMessage when called
// from React; defaults to English for non-React contexts.
// userMap maps user IDs to display names for resolving user/multiuser field values.
export function resolveTemplatePreview(
    template: string,
    fields: TemplatePropertyField[],
    values: Record<string, unknown>,
    systemTokens?: Record<string, string>,
    userMap?: Record<string, string>,
): string {
    const normalizedSystemTokens: Record<string, string> = {};
    if (systemTokens) {
        for (const [k, v] of Object.entries(systemTokens)) {
            normalizedSystemTokens[k.toUpperCase()] = v;
        }
    }
    const defaultSystemTokens: Record<string, string> = {
        SEQ: 'N',
        OWNER: DEFAULT_OWNER_TOKEN,
        CREATOR: DEFAULT_CREATOR_TOKEN,
        ...normalizedSystemTokens,
    };

    return template.replace(/\{([^}]+)\}/g, (match, inner: string) => {
        const name = inner.trim();
        const upper = name.toUpperCase();

        // System tokens
        if (upper in defaultSystemTokens) {
            return defaultSystemTokens[upper];
        }

        const field = fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
        if (!field) {
            return match;
        }
        const val = values[field.id];
        if (val === undefined || val === null || val === '') {
            return match;
        }
        if (field.type === PropertyFieldType.Select && typeof val === 'string' && field.attrs?.options) {
            const opt = field.attrs?.options.find((o) => o.id === val);
            return opt?.name ?? val;
        }
        if (field.type === PropertyFieldType.Multiselect && Array.isArray(val) && field.attrs?.options) {
            return val.map((v: string) => {
                const opt = field.attrs?.options?.find((o) => o.id === v);
                return opt?.name ?? v;
            }).join(', ');
        }
        if (field.type === PropertyFieldType.User && typeof val === 'string' && val) {
            return userMap?.[val] ?? val;
        }
        if (field.type === PropertyFieldType.Multiuser && Array.isArray(val)) {
            return val.map((v: string) => userMap?.[v] ?? v).join(', ');
        }
        if (field.type === PropertyFieldType.Date && typeof val === 'string' && val) {
            const epoch = parseInt(val, 10);

            // Require > 1e12 to distinguish epoch-ms values from compact YYYYMMDD
            // integers (e.g. parseInt('20250101') === 20250101 which is > 0 but
            // represents 1970-01-01 as a timestamp, not 2025-01-01).
            if (!isNaN(epoch) && epoch > EPOCH_MS_MIN) {
                return new Date(epoch).toISOString().split('T')[0];
            }

            // Treat bare YYYY-MM-DD strings as UTC to avoid timezone-offset date shifts.
            const isoDate = (/^\d{4}-\d{2}-\d{2}$/).test(val) ? val + 'T00:00:00Z' : val;
            const d = new Date(isoDate);
            if (!isNaN(d.getTime())) {
                // Extract the date portion directly from the original string to avoid UTC conversion shifting the date
                const dateMatch = val.match(/^(\d{4}-\d{2}-\d{2})/);
                return dateMatch ? dateMatch[1] : d.toISOString().split('T')[0];
            }
            return val; // unknown format — return raw value as-is
        }
        if (field.type === PropertyFieldType.Date && typeof val === 'number' && val > 0) {
            return new Date(val).toISOString().split('T')[0];
        }
        return String(val);
    });
}
