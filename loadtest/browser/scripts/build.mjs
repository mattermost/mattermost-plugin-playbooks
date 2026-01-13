import {build} from 'esbuild';

await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: 'dist/index.mjs',
    external: ['playwright', '@playwright/test', '@mattermost/playwright-lib'],
});
