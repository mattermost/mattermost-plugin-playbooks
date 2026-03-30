// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > creation rules', {testIsolation: true}, () => {
    let testTeam;
    let testOwner;
    let testAlternateOwner;
    let testPlaybook;

    const startRunAndAssertOwner = (playbookId, runName, expectedOwnerId) => {
        cy.playbooksStartRunViaModal(playbookId, runName);
        cy.url().should('include', '/playbooks/runs/');
        cy.playbooksAssertRunPropertyFromUrl('owner_user_id', expectedOwnerId);
    };

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testOwner = user;

            // # Create an alternate owner user
            cy.apiCreateAndAddUserToTeam(testTeam.id).then((newUser) => {
                testAlternateOwner = newUser;
            });

            // # Login as testOwner to create the playbook
            cy.apiLogin(testOwner);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: `Creation Rules Playbook ${getRandomId()}`,
                memberIDs: [],
                makePublic: true,
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    after(() => {
        // # Clean up the shared playbook created in before()
        cy.apiLogin(testOwner);
        cy.apiArchivePlaybook(testPlaybook.id);
    });

    beforeEach(() => {
        // # Size the viewport
        cy.viewport('macbook-13');

        // # Login as testOwner
        cy.apiLogin(testOwner);

        // # Reset creation rules to a clean state before each test
        cy.apiPatchPlaybook(testPlaybook.id, {creation_rules: []});
    });

    it('catch-all rule (nil condition) always applies and sets owner', () => {
        // # Set a catch-all creation rule on the playbook
        cy.apiPatchPlaybook(testPlaybook.id, {
            creation_rules: [{set_owner_id: testAlternateOwner.id}],
        });

        // # Start a run via UI and assert the owner was changed by the creation rule
        const runName = 'Catch-all rule run ' + getRandomId();
        startRunAndAssertOwner(testPlaybook.id, runName, testAlternateOwner.id);
    });

    it('does not apply creation rule when no rules are set', () => {
        // # Clear creation rules on the playbook
        cy.apiPatchPlaybook(testPlaybook.id, {creation_rules: []});

        // # Start a run via UI and assert the owner is still testOwner (default, no rule applied)
        const runName = 'No-rules run ' + getRandomId();
        startRunAndAssertOwner(testPlaybook.id, runName, testOwner.id);
    });

    it('first matching catch-all rule wins over a later catch-all rule', () => {
        // # Create a second alternate owner to serve as the "second rule" target
        cy.apiCreateAndAddUserToTeam(testTeam.id).then((secondAlternateOwner) => {
            // # Set two catch-all rules — first one should win
            cy.apiPatchPlaybook(testPlaybook.id, {
                creation_rules: [
                    {set_owner_id: testAlternateOwner.id}, // first rule: should win
                    {set_owner_id: secondAlternateOwner.id}, // second rule: should be ignored
                ],
            });

            // # Start a run via UI and assert the owner is testAlternateOwner (first rule wins)
            const runName = 'First-match rule run ' + getRandomId();
            startRunAndAssertOwner(testPlaybook.id, runName, testAlternateOwner.id);
        });
    });

    it('creation rules are preserved after an unrelated playbook update', () => {
        // # Set a catch-all creation rule
        cy.apiPatchPlaybook(testPlaybook.id, {
            creation_rules: [{set_owner_id: testAlternateOwner.id}],
        });

        // # Update an unrelated field (title) without specifying creation_rules (null = preserve)
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            playbook.title = 'Creation Rules Playbook Updated';
            delete playbook.creation_rules;
            cy.apiUpdatePlaybook(playbook);
        });

        // # Start a run via UI to prove the creation rule still fires after the unrelated update
        const runName = 'Preservation Check Run ' + getRandomId();
        startRunAndAssertOwner(testPlaybook.id, runName, testAlternateOwner.id);
    });

    it('creation rules can be cleared by setting an empty array', () => {
        // # Set a catch-all rule first
        cy.apiPatchPlaybook(testPlaybook.id, {
            creation_rules: [{set_owner_id: testAlternateOwner.id}],
        });

        // # Clear the rules by setting an empty array
        cy.apiPatchPlaybook(testPlaybook.id, {creation_rules: []});

        // * Assert via API that the creation rules are now empty before UI assertion
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            expect(playbook.creation_rules ?? []).to.have.length(0);
        });

        // # Start a run via UI and verify the owner is the default (no rule applied)
        const runName = 'Cleared-rules run ' + getRandomId();
        startRunAndAssertOwner(testPlaybook.id, runName, testOwner.id);
    });
});
