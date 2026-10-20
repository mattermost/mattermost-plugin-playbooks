// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Tests are never silently disabled. Allowed:
//   - conditional skips with a reason: test.skip(condition, 'reason') (e.g. license gates)
//   - known product bugs: test.fixme('title', body) or test.fixme(condition, 'reason')
// Disallowed:
//   - test.skip('title', body) / test.describe.skip(...): declares a disabled test
//   - test.skip() / test.fixme() without a reason
//   - .only (also caught by playwright/no-focused-test)

function chain(node) {
    // Returns ['test', 'describe', 'skip'] for test.describe.skip
    const parts = [];
    let cur = node;
    while (cur && cur.type === 'MemberExpression' && !cur.computed) {
        parts.unshift(cur.property.name);
        cur = cur.object;
    }
    if (cur && cur.type === 'Identifier') {
        parts.unshift(cur.name);
        return parts;
    }
    return null;
}

const isString = (n) => Boolean(n) && ((n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateLiteral');

export default {
    meta: {
        type: 'problem',
        docs: {description: 'Disallow unconditional skips; product bugs use test.fixme with a reason'},
        schema: [],
        messages: {
            skipDeclared: 'Do not declare skipped tests. A known product bug uses `test.fixme(...)` with a reason; an environment gate uses `test.skip(condition, reason)`.',
            describeSkip: 'Do not skip whole describe blocks. Use `test.fixme`/conditional `test.skip(condition, reason)` per test or in a hook.',
            noReason: '`{{name}}` needs a reason: `{{name}}(condition, \'why\')`.',
            only: 'Do not commit `.only`.',
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                const parts = chain(node.callee);
                if (!parts || parts[0] !== 'test') {
                    return;
                }
                const last = parts[parts.length - 1];
                const [a, b] = node.arguments;
                if (last === 'only') {
                    context.report({node, messageId: 'only'});
                    return;
                }
                if (parts.length === 3 && parts[1] === 'describe' && (last === 'skip' || last === 'fixme')) {
                    context.report({node, messageId: 'describeSkip'});
                    return;
                }
                if (parts.length !== 2 || (last !== 'skip' && last !== 'fixme')) {
                    return;
                }
                const name = `test.${last}`;
                // test.skip('title', fn)
                if (last === 'skip' && isString(a) && b && (b.type === 'ArrowFunctionExpression' || b.type === 'FunctionExpression' || b.type === 'ObjectExpression')) {
                    context.report({node, messageId: 'skipDeclared'});
                    return;
                }
                // test.fixme('title', fn) declares a fixme test with a title: allowed.
                if (last === 'fixme' && isString(a)) {
                    return;
                }
                // Inside a test/hook: requires (condition, reason). The reason may be any expression.
                if (!b) {
                    context.report({node, messageId: 'noReason', data: {name}});
                }
            },
        };
    },
};
