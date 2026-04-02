// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('channels > run dialog', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    let createdPlaybookIds = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create two playbooks so the selector has entries
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
            });

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Second Playbook',
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                createdPlaybookIds.push(playbook.id);
            });
        });
    });

    after(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
    });

    beforeEach(() => {
        cy.apiLogin(testUser);

        // # Navigate to the team and trigger the modal via slash command
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.get('#post_textbox').should('be.visible');

        cy.openPlaybookRunDialogFromSlashCommand();

        // * Verify the RunPlaybookModal opened (select-playbook step)
        cy.get('#playbooks_run_playbook_dialog').should('exist');
    });

    it('shows playbook selector on open', () => {
        // * Modal should show the playbook list
        cy.get('#playbooks_run_playbook_dialog').within(() => {
            cy.findByText('Run playbook').should('exist');
            cy.findByText('Playbook').should('exist');
        });
    });

    it('Start run is disabled until a name is entered (no template)', () => {
        // # Select a playbook without a template
        cy.get('#playbooks_run_playbook_dialog').findByText('Playbook').click();

        // * Start run should be disabled with blank name
        cy.findByRole('button', {name: /start run/i}).should('be.disabled');

        // # Type a run name
        cy.findByTestId('run-name-input').type('My Run');

        // * Start run should now be enabled
        cy.findByRole('button', {name: /start run/i}).should('not.be.disabled');
    });

    it('is canceled when Cancel is clicked', () => {
        // # Select a playbook to get to run-details step
        cy.get('#playbooks_run_playbook_dialog').findByText('Playbook').click();

        const playbookRunName = 'New Run' + getRandomId();
        cy.findByTestId('run-name-input').type(playbookRunName);

        // # Cancel the modal
        cy.findByRole('button', {name: /cancel/i}).click();

        // * Verify the modal is gone
        cy.get('#playbooks_run_playbook_dialog').should('not.exist');

        // * Verify the run was not created
        cy.apiGetAllPlaybookRuns(testTeam.id).then((response) => {
            const allPlaybookRuns = response.body;
            const playbookRun = allPlaybookRuns.items.find((inc) => inc.name === playbookRunName);
            expect(playbookRun).to.be.undefined;
        });
    });

    it('creates a run successfully via slash command dialog', () => {
        const playbookRunName = 'Slash Cmd Run ' + getRandomId();

        // # Select a playbook
        cy.get('#playbooks_run_playbook_dialog').findByText('Playbook').click();

        // # Type a run name
        cy.findByTestId('run-name-input').type(playbookRunName);

        // # Click Start run
        cy.findByRole('button', {name: /start run/i}).click();

        // * Verify the modal closes
        cy.get('#playbooks_run_playbook_dialog').should('not.exist');

        // * Verify navigation away from town-square (to the new run channel)
        cy.url().should('not.include', '/town-square');

        // * Verify the run was created via API
        cy.apiGetAllPlaybookRuns(testTeam.id).then((response) => {
            const allPlaybookRuns = response.body;
            const playbookRun = allPlaybookRuns.items.find((inc) => inc.name === playbookRunName);
            expect(playbookRun).to.not.be.undefined;
            expect(playbookRun.name).to.equal(playbookRunName);
        });
    });
});
