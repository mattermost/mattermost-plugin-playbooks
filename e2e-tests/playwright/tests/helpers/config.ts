// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {readJsonOrThrow, requestedWith} from './client';

// A loosely-typed slice of the Mattermost admin config; callers only patch the
// handful of nested keys they care about (feature flags, beta features, ...).
export type AdminConfigValue = string | number | boolean | null | AdminConfig | AdminConfigValue[];
export type AdminConfig = {[key: string]: AdminConfigValue};

function isPlainObject(value: AdminConfigValue): value is AdminConfig {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Recursively merges `patch` into `base`, matching the Cypress apiUpdateConfig
// deep-merge behavior so a caller can patch e.g.
// `PluginSettings.Plugins.playbooks.BetaFeatures.task_requirements` without
// clobbering sibling keys.
function deepMerge(base: AdminConfig, patch: AdminConfig): AdminConfig {
    const result: AdminConfig = {...base};
    for (const key of Object.keys(patch)) {
        const patchValue = patch[key];
        const baseValue = base[key];
        if (isPlainObject(patchValue) && isPlainObject(baseValue)) {
            result[key] = deepMerge(baseValue, patchValue);
        } else {
            result[key] = patchValue;
        }
    }
    return result;
}

export async function getConfig(page: Page): Promise<AdminConfig> {
    const response = await page.request.get('/api/v4/config', requestedWith);
    return readJsonOrThrow<AdminConfig>(response, 'Unable to fetch config');
}

// Patches the server config (as sysadmin): fetches the current config, deep-merges
// `partial` into it, and PUTs the merged config back. Used for feature flags like
// App Bar / beta features / EnableTesting.
export async function patchConfig(page: Page, partial: AdminConfig): Promise<AdminConfig> {
    const currentConfig = await getConfig(page);
    const merged = deepMerge(currentConfig, partial);

    const response = await page.request.put('/api/v4/config', {
        ...requestedWith,
        data: merged,
    });

    if (!response.ok()) {
        throw new Error(`Unable to update config: ${response.status()} ${await response.text()}`);
    }

    return await response.json() as AdminConfig;
}
