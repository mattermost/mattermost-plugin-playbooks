import js from '@eslint/js';
import globals from 'globals';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

import playbooksE2E from './eslint-rules/index.mjs';

export default tseslint.config(
    {
        ignores: ['node_modules', 'playwright-report', 'results', 'test-results'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    args: 'after-used',
                },
            ],
        },
    },
    {
        files: ['tests/**/*.ts'],
        ...playwright.configs['flat/recommended'],
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            ...playwright.configs['flat/recommended'].rules,
        },
    },
    {
        // Conventions from AGENTS.md, enforced in spec files by the local plugin
        // in eslint-rules/ (tested by `npm run test:eslint-rules`):
        // POM is mandatory (no locators in specs), no fixed waits, and no silent skips.
        files: ['tests/**/*.spec.ts'],
        plugins: {'playbooks-e2e': playbooksE2E},
        rules: {
            'playbooks-e2e/no-locators-in-specs': 'error',
            'playbooks-e2e/no-fixed-waits': 'error',
            'playbooks-e2e/no-unconditional-skip': 'error',
        },
    },
);
