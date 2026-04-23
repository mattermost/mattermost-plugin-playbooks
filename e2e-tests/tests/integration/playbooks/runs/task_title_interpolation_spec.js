// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > task title placeholder interpolation', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let createdPlaybookIds = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        createdPlaybookIds.forEach((id) => cy.apiArchivePlaybook(id));
        createdPlaybookIds = [];
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    it('task title placeholder is resolved at run creation using the provided property value', () => {
        // # Create a playbook with a text property field Zone and a task that references it
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Zone Interpolation Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{title: 'Stage 1', items: [{title: 'Deploy to {Zone}'}]}],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            cy.apiAddPropertyField(playbook.id, {
                name: 'Zone',
                type: 'text',
                attrs: {visibility: 'always', sortOrder: 1},
            }).then(() => {
                // # Patch the playbook to add channel_name_template referencing Zone
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{Zone} Channel'});

                // # Open the run modal and fill in Zone = EMEA
                cy.playbooksOpenRunModal(playbook.id);

                cy.get('#root-portal.modal-open').within(() => {
                    // # Fill in the Zone field inside the modal Attributes section
                    cy.findByLabelText('Zone').type('EMEA');
                });

                // # Submit to start the run
                cy.get('#root-portal.modal-open').within(() => {
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Verify we are on the run details page
                cy.url().should('include', '/playbooks/runs/');

                // * Fetch the run via API and assert the task title is resolved
                cy.playbooksGetRunIdFromUrl().then((runId) => {
                    cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                        const firstItem = run.checklists[0].items[0];
                        expect(firstItem.title).to.equal('Deploy to EMEA');
                    });
                });
            });
        });
    });

    it('task title placeholder is frozen at creation time and not re-evaluated when property changes', () => {
        // # Create a playbook with a text property field Zone and a task that references it
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Freeze Placeholder Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{title: 'Stage 1', items: [{title: 'Deploy to {Zone}'}]}],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            cy.apiAddPropertyField(playbook.id, {
                name: 'Zone',
                type: 'text',
                attrs: {visibility: 'always', sortOrder: 1},
            }).then(() => {
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{Zone} Channel'});

                // # Open the run modal and fill in Zone = EMEA, then start the run
                cy.playbooksOpenRunModal(playbook.id);

                cy.get('#root-portal.modal-open').within(() => {
                    cy.findByLabelText('Zone').type('EMEA');
                    cy.findByTestId('modal-confirm-button').click();
                });

                cy.url().should('include', '/playbooks/runs/');

                cy.playbooksGetRunIdFromUrl().then((runId) => {
                    // # Change the Zone property value to APAC via UI (we're already on the run details page)
                    cy.playbooksSetRunPropertyViaUI('run-property-zone', 'APAC', {type: 'text'});

                    // * Confirm the Zone property change to APAC was actually persisted server-side
                    cy.assertRunPropertyValueStored(runId, 'Zone', 'APAC');

                    // * Assert the task title still reflects the creation-time value EMEA
                    cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                        const firstItem = run.checklists[0].items[0];
                        expect(firstItem.title).to.equal('Deploy to EMEA');
                    });
                });
            });
        });
    });

    it('unknown placeholder in task title is left as-is (fail-open)', () => {
        // # Create a playbook with a task that references a field that does not exist
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Unknown Placeholder Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            makePublic: true,
            createPublicPlaybookRun: true,
            checklists: [{title: 'Stage 1', items: [{title: 'Deploy to {UnknownField}'}]}],
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Start the run directly via API (no required fields)
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: playbook.id,
                playbookRunName: 'Unknown Placeholder Run ' + getRandomId(),
                ownerUserId: testUser.id,
            }).then((run) => {
                // * Assert the task title is unchanged — placeholder not broken, not empty
                cy.apiGetPlaybookRun(run.id).then(({body: fetchedRun}) => {
                    const firstItem = fetchedRun.checklists[0].items[0];
                    expect(firstItem.title).to.equal('Deploy to {UnknownField}');
                });
            });
        });
    });
});
