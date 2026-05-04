// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('playbooks > owner_group_only_actions toggle', {testIsolation: true}, () => {
    let testTeam;
    let testAdmin;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testAdmin = user;
        });
    });

    beforeEach(() => {
        cy.viewport('macbook-13');
        cy.apiLogin(testAdmin);
    });

    it('persists the enabled state after a page reload', () => {
        // # Create playbook (default: owner_group_only_actions = false)
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Toggle Persistence Playbook ' + getRandomId(),
            memberIDs: [],
            makePublic: true,
        }).then((playbook) => {
            // # Open the outline editor
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            // * Toggle starts unchecked
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('not.be.checked');

            // # Intercept the persistence request so we can wait for it
            cy.intercept('PUT', `**/api/v0/playbooks/${playbook.id}`).as('persistToggle');

            // # Enable the toggle (fires confirmation modal for false→true)
            cy.playbooksToggleWithConfirmation('owner-group-only-actions-toggle');

            // * Toggle reflects the new state immediately
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('be.checked');

            // # Wait for the server to persist before reloading
            cy.wait('@persistToggle').its('response.statusCode').should('be.oneOf', [200, 204]);

            // # Reload the page — state should come from the server, not memory
            cy.reload();

            // * Toggle remains checked after reload
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('be.checked');
        });
    });

    it('persists the disabled state after a page reload', () => {
        // # Create playbook and enable the flag via API so we can test the reverse flip
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Toggle Disable Playbook ' + getRandomId(),
            memberIDs: [],
            makePublic: true,
        }).then((playbook) => {
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            cy.intercept('PUT', `**/api/v0/playbooks/${playbook.id}`).as('persistEnable');
            cy.playbooksToggleWithConfirmation('owner-group-only-actions-toggle');
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('be.checked');
            cy.wait('@persistEnable').its('response.statusCode').should('be.oneOf', [200, 204]);

            // # Disable: true→false does not require confirmation
            cy.intercept('PUT', `**/api/v0/playbooks/${playbook.id}`).as('persistDisable');
            cy.findByTestId('owner-group-only-actions-toggle').find('label').click();

            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('not.be.checked');

            cy.wait('@persistDisable').its('response.statusCode').should('be.oneOf', [200, 204]);

            // # Reload
            cy.reload();

            // * Toggle remains unchecked after reload
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('not.be.checked');
        });
    });

    it('toggle is disabled on an archived playbook', () => {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Archived Toggle Playbook ' + getRandomId(),
            memberIDs: [],
            makePublic: true,
        }).then((playbook) => {
            // # Archive the playbook
            cy.apiArchivePlaybook(playbook.id);

            // # Open the outline editor for the archived playbook
            cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

            // * Toggle input is disabled (archived guard in handleOwnerGroupOnlyActionsChange)
            cy.findByTestId('owner-group-only-actions-toggle').
                find('input').
                should('be.disabled');
        });
    });
});
