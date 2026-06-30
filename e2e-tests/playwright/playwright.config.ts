// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.ts',
    globalSetup: './tests/helpers/bootstrap.ts',
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: false,
    timeout: 60_000,
    outputDir: 'test-results',
    reporter: [
        ['list'],
        ['junit', {outputFile: 'results/junit/test-results.xml'}],
    ],
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    use: {
        baseURL: process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'off',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
});
