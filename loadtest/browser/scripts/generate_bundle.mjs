// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {build} from 'esbuild';

async function generateBundle() {
    await build({
        entryPoints: ['src/index.ts'],
        bundle: true,
        platform: 'node',
        format: 'esm',
        outfile: 'dist/index.mjs',
        external: [
            '@mattermost/loadtest-browser-lib',
            '@mattermost/playwright-lib',
            '@playwright/test',
        ],
    });
}


await generateBundle();
