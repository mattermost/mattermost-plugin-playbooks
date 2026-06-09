// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Playwright port of the Cypress spec
// e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/header_spec.js.
// Covers the playbook-editor header actions: rename, edit description, duplicate.

import {test} from '@playwright/test';

import {loginAs, loginAsAdmin} from '../helpers/auth';
import {createPlaybook} from '../helpers/playbook';
import {addUserToTeam, createTeam} from '../helpers/team';
import {type SeededUser, createUser} from '../helpers/user';
import {PlaybookEditorPage} from '../pages/playbook_editor_page';
import {PlaybooksPage} from '../pages/playbooks_page';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

interface EditorData {
    teamName: string;
    teamId: string;
    user: SeededUser;
}

test.describe('playbook editor header', () => {
    let seededData: EditorData;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        // Seed (as admin) a team and a member user; each test creates its own
        // playbook as that user so the user owns and can edit it.
        await loginAsAdmin(page);
        const team = await createTeam(page, 'pb-edit');
        const user = await createUser(page, 'pb-edit-user');
        await addUserToTeam(page, team.id, user.id);
        seededData = {teamName: team.name, teamId: team.id, user};

        await context.close();
    });

    /**
     * @objective Rename a playbook from the editor title menu and persist the change.
     */
    test('updates the playbook name', {tag: '@playbooks'}, async ({page}) => {
        const editor = new PlaybookEditorPage(page);

        // # Log in as the owning user and open a freshly created playbook's outline
        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `Rename Me ${Date.now()}`);
        await editor.goto(seededData.teamName, playbook.id);

        // # Rename the playbook
        await editor.rename('renamed playbook');

        // * The editor shows the updated name
        await editor.expectTitle('renamed playbook');

        // * The new name persists across a reload
        await page.reload();
        await editor.expectTitle('renamed playbook');
    });

    /**
     * @objective Edit a playbook's description from the editor and persist the change.
     */
    test('updates the playbook description', {tag: '@playbooks'}, async ({page}) => {
        const editor = new PlaybookEditorPage(page);
        const originalDescription = 'Describe me please';

        // # Log in as the owning user and open a playbook seeded with a known description
        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, `Describe Me ${Date.now()}`, {
            description: originalDescription,
        });
        await editor.goto(seededData.teamName, playbook.id);

        // # Replace the description
        await editor.editDescription(originalDescription, 'some new description');

        // * The new description persists across a reload
        await page.reload();
        await editor.expectDescription('some new description');
    });

    /**
     * @objective Duplicate a playbook from the editor title menu.
     */
    test('duplicates the playbook', {tag: '@playbooks'}, async ({page}) => {
        const editor = new PlaybookEditorPage(page);
        const playbooksPage = new PlaybooksPage(page);
        const title = `Duplicate Me ${Date.now()}`;

        // # Log in as the owning user and open the playbook's outline
        await loginAs(page, seededData.user.username, seededData.user.password);
        const playbook = await createPlaybook(page, seededData.teamId, title);
        await editor.goto(seededData.teamName, playbook.id);

        // # Duplicate it
        await editor.duplicate();

        // * The duplicate opens with a "Copy of" title and appears in the LHS
        await editor.expectTitle(`Copy of ${title}`);
        await playbooksPage.expectPlaybookInLHS(`Copy of ${title}`);
    });
});
