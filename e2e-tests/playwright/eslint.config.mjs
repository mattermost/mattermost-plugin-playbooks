import js from '@eslint/js';
import globals from 'globals';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

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
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'Literal[value=/api.v0.query/], TemplateElement[value.raw=/api.v0.query/]',
                    message: 'e2e tests must not call or intercept the GraphQL endpoint; use REST helpers and assert on UI or server state.',
                },
                {
                    selector: "Property[key.name='operationName']",
                    message: 'e2e tests must not depend on GraphQL operations; assert on UI or server state instead.',
                },
            ],
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
);
