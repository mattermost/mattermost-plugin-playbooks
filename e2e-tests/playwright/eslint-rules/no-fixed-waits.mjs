// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// No fixed-time waits in specs (see e2e-tests/playwright/AGENTS.md): wait for
// state with web-first `expect`, `expect.poll`, or `page.waitForResponse`.

export default {
    meta: {
        type: 'problem',
        docs: {description: 'Disallow fixed-time waits (waitForTimeout, setTimeout) in spec files'},
        schema: [],
        messages: {
            waitForTimeout: 'No fixed waits (`waitForTimeout`). Wait for state instead: web-first expect, expect.poll, waitForResponse.',
            setTimeout: 'No fixed waits (`setTimeout`). Wait for state instead: web-first expect, expect.poll, waitForResponse.',
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                const {callee} = node;
                if (callee.type === 'MemberExpression' && !callee.computed && callee.property.name === 'waitForTimeout') {
                    context.report({node: callee.property, messageId: 'waitForTimeout'});
                } else if (callee.type === 'Identifier' && callee.name === 'setTimeout') {
                    context.report({node: callee, messageId: 'setTimeout'});
                }
            },
        };
    },
};
