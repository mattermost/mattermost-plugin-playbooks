// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Playwright port of the Cypress spec
// e2e-tests/cypress/tests/integration/playbooks/playbooks/creation_button_spec.js.
// Covers every case in that spec so it can be retired:
//   - create via the "Create playbook" button (Untitled Playbook)
//   - create from the "Blank" template
//   - create from the "Incident Resolution" template (multiple teams)
//   - permissions: dropdown entry hidden / notice shown / button hidden

import {test} from '@playwright/test';

import {loginAs, loginAsAdmin} from '../helpers/auth';
import {uniqueSuffix} from '../helpers/client';
import {createPlaybook} from '../helpers/playbook';
import {addUserToTeam, createTeam, createTeamScheme, getTeamMemberRole, setRolePermissions, setTeamScheme} from '../helpers/team';
import {type SeededUser, createUser} from '../helpers/user';
import {PlaybookEditorPage} from '../pages/playbook_editor_page';
import {PlaybooksPage} from '../pages/playbooks_page';

const baseURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

interface CreationData {
    teamName: string;
    user: SeededUser;
}

interface RestrictedData {
    emptyTeamName: string;
    populatedTeamName: string;
    populatedPlaybookTitle: string;
    user: SeededUser;
}

test.describe('playbooks creation', () => {
    let seededData: CreationData;

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        // Seed (as admin) a user that belongs to two teams (so creation exercises
        // the multi-team path) plus an existing playbook so the list view renders.
        await loginAsAdmin(page);
        const team = await createTeam(page, 'playbooks-create');
        const secondTeam = await createTeam(page, 'playbooks-create-second');
        const user = await createUser(page, 'playbooks-create-user');
        await addUserToTeam(page, team.id, user.id);
        await addUserToTeam(page, secondTeam.id, user.id);
        await createPlaybook(page, team.id, `PW Existing Playbook ${uniqueSuffix()}`);
        seededData = {teamName: team.name, user};

        await context.close();
    });

    /**
     * @objective Create a playbook from the "Create playbook" button and land on its outline.
     */
    test('creates a playbook with the Create playbook button', {tag: '@playbooks'}, async ({page}) => {
        const playbooksPage = new PlaybooksPage(page);
        const playbookEditorPage = new PlaybookEditorPage(page);

        // # Log in as the seeded user and open the playbooks list
        await loginAs(page, seededData.user.username, seededData.user.password);
        await playbooksPage.goto(seededData.teamName);
        await playbooksPage.openPlaybooksList();

        // # Create a playbook from the modal without naming it
        await playbooksPage.createPlaybookFromModal();

        // * The new "Untitled Playbook" outline opens and appears in the LHS
        await playbookEditorPage.expectOutlineOpened('Untitled Playbook');
        await playbooksPage.expectPlaybookInLHS('Untitled Playbook');
    });

    /**
     * @objective Create a playbook from the "Blank" template option.
     */
    test('creates a playbook from the Blank template', {tag: '@playbooks'}, async ({page}) => {
        const playbooksPage = new PlaybooksPage(page);
        const playbookEditorPage = new PlaybookEditorPage(page);

        // Selecting the Blank template instantly creates "@<username>'s Blank".
        const newPlaybookTitle = `@${seededData.user.username}'s Blank`;

        // # Log in as the seeded user and open the playbooks list
        await loginAs(page, seededData.user.username, seededData.user.password);
        await playbooksPage.goto(seededData.teamName);
        await playbooksPage.openPlaybooksList();

        // # Select the Blank template
        await playbooksPage.createPlaybookFromTemplate('Blank');

        // * The new playbook outline opens and appears in the LHS
        await playbookEditorPage.expectOutlineOpened(newPlaybookTitle);
        await playbooksPage.expectPlaybookInLHS(newPlaybookTitle);
    });

    /**
     * @objective Create a playbook from a named template and confirm it lands in the current team.
     *
     * @precondition
     * The seeded user is a member of two teams.
     */
    test('creates a playbook from the Incident Resolution template (multiple teams)', {tag: '@playbooks'}, async ({page}) => {
        const playbooksPage = new PlaybooksPage(page);
        const playbookEditorPage = new PlaybookEditorPage(page);

        const newPlaybookTitle = `@${seededData.user.username}'s Incident Resolution`;

        // # Log in as the seeded user and open the playbooks list for the first team
        await loginAs(page, seededData.user.username, seededData.user.password);
        await playbooksPage.goto(seededData.teamName);
        await playbooksPage.openPlaybooksList();

        // # Select the Incident Resolution template
        await playbooksPage.createPlaybookFromTemplate('Incident Resolution');

        // * The new playbook outline opens and appears in the current team's LHS
        await playbookEditorPage.expectOutlineOpened(newPlaybookTitle);
        await playbooksPage.expectPlaybookInLHS(newPlaybookTitle);
    });
});

test.describe('playbooks creation without permission', () => {
    let seededData: RestrictedData;

    // Restricting playbook creation needs a custom team scheme, which requires
    // an enterprise license. CI provides one (MM_LICENSE); a plain local server
    // does not, so these cases skip gracefully there.
    let skipReason = '';

    test.beforeAll(async ({browser}) => {
        const context = await browser.newContext({baseURL});
        const page = await context.newPage();

        await loginAsAdmin(page);
        try {
            // A scheme whose team member role cannot create playbooks, applied to
            // two teams: one empty and one already holding a playbook.
            const scheme = await createTeamScheme(page, 'pb-create-restricted scheme');
            const emptyTeam = await createTeam(page, 'pb-create-restricted-empty');
            const populatedTeam = await createTeam(page, 'pb-create-restricted-populated');
            await setTeamScheme(page, emptyTeam.id, scheme.id);
            await setTeamScheme(page, populatedTeam.id, scheme.id);

            const user = await createUser(page, 'pb-create-restricted-user');
            await addUserToTeam(page, emptyTeam.id, user.id);
            await addUserToTeam(page, populatedTeam.id, user.id);

            const memberRole = await getTeamMemberRole(page, scheme);
            const permissions = memberRole.permissions.filter((perm) => !(/playbook_(private|public)_create/).test(perm));
            await setRolePermissions(page, memberRole.id, permissions);

            const populatedPlaybookTitle = `PW Restricted Playbook ${uniqueSuffix()}`;
            await createPlaybook(page, populatedTeam.id, populatedPlaybookTitle);

            seededData = {
                emptyTeamName: emptyTeam.name,
                populatedTeamName: populatedTeam.name,
                populatedPlaybookTitle,
                user,
            };
        } catch (err) {
            if (String(err).includes('does not support creating permissions schemes')) {
                skipReason = 'Custom team schemes require an enterprise license (set MM_LICENSE).';
            } else {
                await context.close();
                throw err;
            }
        }

        await context.close();
    });

    test.beforeEach(() => {
        test.skip(Boolean(skipReason), skipReason);
    });

    /**
     * @objective Hide the "Create New Playbook" dropdown entry from users without create permission.
     *
     * @precondition
     * The seeded user's team member role cannot create playbooks (requires a license).
     */
    test('hides the Create New Playbook entry in the dropdown', {tag: '@playbooks'}, async ({page}) => {
        const playbooksPage = new PlaybooksPage(page);

        // # Log in as the restricted user and open the Playbooks product
        await loginAs(page, seededData.user.username, seededData.user.password);
        await playbooksPage.goto(seededData.emptyTeamName);

        // # Open the create-playbook dropdown
        await playbooksPage.openCreatePlaybookDropdown();

        // * The dropdown opened, but the "Create New Playbook" entry is absent
        await playbooksPage.expectCreatePlaybookDropdownOpen();
        await playbooksPage.expectCreatePlaybookEntryHidden();
    });

    /**
     * @objective Show a no-permission notice when a restricted user has no playbooks to view.
     *
     * @precondition
     * The seeded user's team member role cannot create playbooks (requires a license).
     */
    test('shows a permission notice when no playbooks exist', {tag: '@playbooks'}, async ({page}) => {
        const playbooksPage = new PlaybooksPage(page);

        // # Log in as the restricted user and open the playbooks list of the empty team
        await loginAs(page, seededData.user.username, seededData.user.password);
        await playbooksPage.goto(seededData.emptyTeamName);
        await playbooksPage.openPlaybooksList();

        // * The no-permission notice is shown
        await playbooksPage.expectNoCreatePermissionNotice();
    });

    /**
     * @objective Hide the "Create playbook" button from a restricted user even when playbooks exist.
     *
     * @precondition
     * The seeded user's team member role cannot create playbooks (requires a license),
     * and the team already contains a playbook.
     */
    test('hides the Create playbook button when playbooks exist', {tag: '@playbooks'}, async ({page}) => {
        const playbooksPage = new PlaybooksPage(page);

        // # Log in as the restricted user and open the playbooks list of the populated team
        await loginAs(page, seededData.user.username, seededData.user.password);
        await playbooksPage.goto(seededData.populatedTeamName);
        await playbooksPage.openPlaybooksList();

        // * The existing playbook is listed but the create button is absent
        await playbooksPage.expectPlaybookVisible(seededData.populatedPlaybookTitle);
        await playbooksPage.expectCreatePlaybookButtonHidden();
    });
});
