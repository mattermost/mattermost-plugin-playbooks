// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Run: npm run test:eslint-rules   (node --test)

import {after, describe, it} from 'node:test';

import {RuleTester} from 'eslint';
import tseslint from 'typescript-eslint';

import noFixedWaits from '../no-fixed-waits.mjs';
import noLocatorsInSpecs from '../no-locators-in-specs.mjs';
import noUnconditionalSkip from '../no-unconditional-skip.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.afterAll = after;

const ruleTester = new RuleTester({
    languageOptions: {parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module'},
});

const wrap = (body) => `test('t', async ({page}) => {\n${body}\n});`;

ruleTester.run('no-locators-in-specs', noLocatorsInSpecs, {
    valid: [
        // page-object usage
        wrap('const po = new PlaybooksPage(page); await po.openRunsList(); await po.expectRunVisible("x");'),
        wrap('await editor.title.click(); await expect(editor.title).toBeVisible();'),
        // page navigation / misc page APIs are fine
        wrap('await page.goto("/x"); await page.reload(); await expect(page).toHaveURL(/x/);'),
        wrap('await page.keyboard.press("Enter"); await page.mouse.click(1, 2);'),
        // Locator actions with text args are not selector APIs
        wrap('await editor.titleInput.fill("new name"); await editor.titleInput.press("Enter");'),
        // array helpers are not locator refinements
        wrap('const ids = runs.filter((r) => r.active).map((r) => r.id); const x = list.find((y) => y);'),
        wrap('const perms = role.permissions.filter((p) => !(/x/).test(p));'),
        // page-object methods that happen to share names but take no selector
        wrap('await playbooksPage.goto(team.name);'),
    ],
    invalid: [
        {code: wrap('await page.getByRole("button", {name: "x"}).click();'), errors: [{messageId: 'builder'}]},
        {code: wrap('await page.getByTestId("x").click();'), errors: [{messageId: 'builder'}]},
        {code: wrap('await page.locator("#x").click();'), errors: [{messageId: 'builder'}]},
        {code: wrap('await otherPage.getByText("x").click();'), errors: [{messageId: 'builder'}]},
        {code: wrap('await po.container.locator("a").click();'), errors: [{messageId: 'builder'}]},
        {code: wrap('await page.frameLocator("iframe").getByRole("button").click();'), errors: [{messageId: 'builder'}, {messageId: 'builder'}]},
        {code: wrap('await page.$("#x"); await page.$$(".y");'), errors: [{messageId: 'builder'}, {messageId: 'builder'}]},
        {code: wrap('await page.waitForSelector("#x");'), errors: [{messageId: 'builder'}]},
        {code: wrap('await page["locator"]("#x").click();'), errors: [{messageId: 'builder'}]},
        // aliasing / destructuring
        {code: wrap('const find = page.getByRole.bind(page); await find("button").click();'), errors: [{messageId: 'builder'}]},
        {code: wrap('const {getByRole} = page; await getByRole("button").click();'), errors: [{messageId: 'destructure'}]},
        // refinements off a page-object locator
        {code: wrap('await po.items.filter({hasText: "Foo"}).click();'), errors: [{messageId: 'refinement'}]},
        {code: wrap('await po.items.first().click();'), errors: [{messageId: 'refinement'}]},
        {code: wrap('await po.items.last().click();'), errors: [{messageId: 'refinement'}]},
        {code: wrap('await po.items.nth(2).click();'), errors: [{messageId: 'refinement'}]},
        {code: wrap('await po.a.and(po.b).click(); await po.a.or(po.b).click();'), errors: [{messageId: 'refinement'}, {messageId: 'refinement'}]},
        // legacy selector-string APIs
        {code: wrap('await page.click("#save");'), errors: [{messageId: 'legacy'}]},
        {code: wrap('await page.fill("#name", "x");'), errors: [{messageId: 'legacy'}]},
        {code: wrap('await page.check(`#${id}`);'), errors: [{messageId: 'legacy'}]},
        {code: wrap('await viewerPage.hover("#x");'), errors: [{messageId: 'legacy'}]},
        {code: wrap('await this.page.selectOption("select", "a");'), errors: [{messageId: 'legacy'}]},
    ],
});

ruleTester.run('no-fixed-waits', noFixedWaits, {
    valid: [
        wrap('await expect(po.title).toBeVisible(); await expect.poll(() => getRun(id)).toBe(1);'),
        wrap('await page.waitForResponse((r) => r.url().includes("/runs"));'),
    ],
    invalid: [
        {code: wrap('await page.waitForTimeout(500);'), errors: [{messageId: 'waitForTimeout'}]},
        {code: wrap('await new Promise((r) => setTimeout(r, 1000));'), errors: [{messageId: 'setTimeout'}]},
    ],
});

ruleTester.run('no-unconditional-skip', noUnconditionalSkip, {
    valid: [
        // license gate pattern used in create_playbook.spec.ts
        'test.beforeEach(() => { test.skip(Boolean(skipReason), skipReason); });',
        wrap('test.skip(!process.env.MM_LICENSE, "needs a license");'),
        // known product bug, with title or with condition + reason
        'test.fixme("finish button does not update (MM-123)", async ({page}) => {});',
        wrap('test.fixme(true, "participate button stale after leave, see Cypress rdp_main_header");'),
        'test("a", async () => {}); test.describe("d", () => {});',
    ],
    invalid: [
        {code: 'test.skip("disabled test", async ({page}) => {});', errors: [{messageId: 'skipDeclared'}]},
        {code: 'test.describe.skip("d", () => {});', errors: [{messageId: 'describeSkip'}]},
        {code: 'test.describe.fixme("d", () => {});', errors: [{messageId: 'describeSkip'}]},
        {code: wrap('test.skip();'), errors: [{messageId: 'noReason'}]},
        {code: wrap('test.fixme();'), errors: [{messageId: 'noReason'}]},
        {code: wrap('test.skip(true);'), errors: [{messageId: 'noReason'}]},
        {code: 'test.only("x", async () => {});', errors: [{messageId: 'only'}]},
        {code: 'test.describe.only("x", () => {});', errors: [{messageId: 'only'}]},
    ],
});
