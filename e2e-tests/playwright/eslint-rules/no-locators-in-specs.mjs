// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Page Object Model is mandatory (see e2e-tests/playwright/AGENTS.md): spec
// files must not build or refine locators, nor use the legacy selector-string
// action APIs. Locators live in tests/pages/*.

const LOCATOR_BUILDERS = /^(getBy[A-Z]\w*|locator|frameLocator|\$|\$\$|\$eval|\$\$eval|waitForSelector)$/;

// Locator refinements. Arrays have `filter` too, so `filter` only counts when
// called with an options object (Locator.filter({hasText})) rather than a callback.
const REFINEMENTS_NO_ARGS = new Set(['first', 'last']);
const REFINEMENTS_ANY_ARGS = new Set(['nth', 'and', 'or']);

// Page/Frame methods that take a selector string as first argument
// (e.g. page.click('#id')). Locator methods of the same name take no selector.
const LEGACY_SELECTOR_ACTIONS = new Set([
    'check', 'click', 'dblclick', 'dispatchEvent', 'dragAndDrop', 'fill', 'focus', 'getAttribute',
    'hover', 'innerHTML', 'innerText', 'inputValue', 'isChecked', 'isDisabled', 'isEditable',
    'isEnabled', 'isHidden', 'isVisible', 'press', 'selectOption', 'setChecked', 'setInputFiles',
    'tap', 'textContent', 'type', 'uncheck',
]);

// Receivers treated as a Page: the `page` fixture, `<x>Page`/`<x>page` variables
// holding extra pages, and `<obj>.page`. Page objects are named `<x>Page` too,
// but they don't expose methods with these names.
function isPageLike(node) {
    if (node.type === 'Identifier') {
        return node.name === 'page' || (/^[a-z]\w*Page$/).test(node.name);
    }
    return node.type === 'MemberExpression' && !node.computed && node.property.name === 'page';
}

function propName(member) {
    if (member.type !== 'MemberExpression') {
        return null;
    }
    if (!member.computed && member.property.type === 'Identifier') {
        return member.property.name;
    }
    if (member.computed && member.property.type === 'Literal' && typeof member.property.value === 'string') {
        return member.property.value;
    }
    return null;
}

function isStringArg(node) {
    return Boolean(node) && ((node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral');
}

export default {
    meta: {
        type: 'problem',
        docs: {description: 'Disallow building, refining or selecting locators in spec files (POM is mandatory)'},
        schema: [],
        messages: {
            builder: 'Specs must not build locators (`{{name}}`). Add a field or method to a page object in tests/pages/ and use it here (POM is mandatory, see e2e-tests/playwright/AGENTS.md).',
            refinement: 'Specs must not refine locators (`.{{name}}()`). Add a page-object method that returns the refined locator (see AGENTS.md "Composite/filtered locators").',
            legacy: 'Legacy selector API `{{name}}(selector)` is not allowed in specs. Use a page-object locator instead.',
            destructure: 'Do not destructure or alias locator builders (`{{name}}`) to bypass the POM rule.',
        },
    },
    create(context) {
        return {
            // Any reference to a builder member: covers calls, `.bind(...)`, passing it around.
            MemberExpression(node) {
                const name = propName(node);
                if (name && LOCATOR_BUILDERS.test(name)) {
                    context.report({node: node.property, messageId: 'builder', data: {name}});
                }
            },
            CallExpression(node) {
                const name = propName(node.callee);
                if (!name) {
                    return;
                }
                const [first] = node.arguments;
                if (
                    (REFINEMENTS_NO_ARGS.has(name) && node.arguments.length === 0) ||
                    REFINEMENTS_ANY_ARGS.has(name) ||
                    (name === 'filter' && first && first.type === 'ObjectExpression')
                ) {
                    context.report({node: node.callee.property, messageId: 'refinement', data: {name}});
                    return;
                }
                if (LEGACY_SELECTOR_ACTIONS.has(name) && isStringArg(first) && isPageLike(node.callee.object)) {
                    context.report({node: node.callee.property, messageId: 'legacy', data: {name}});
                }
            },
            // const {getByRole} = page;
            ObjectPattern(node) {
                for (const prop of node.properties) {
                    if (prop.type === 'Property' && prop.key.type === 'Identifier' && LOCATOR_BUILDERS.test(prop.key.name)) {
                        context.report({node: prop.key, messageId: 'destructure', data: {name: prop.key.name}});
                    }
                }
            },
        };
    },
};
