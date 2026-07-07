// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../../utils';

describe('playbooks > edit > new channel only', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport
        cy.viewport('macbook-13');

        // # Create a fresh playbook for each test
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'New Channel Only Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            testPlaybook = playbook;
        });
    });

    afterEach(() => {
        // # Login as testUser and archive the playbook created in beforeEach
        cy.apiLogin(testUser);
        if (testPlaybook) {
            cy.apiArchivePlaybook(testPlaybook.id);
        }
    });

    it('shows the Require new channel toggle in the playbook editor', () => {
        // # Visit the playbook outline editor
        cy.visitPlaybookEditor(testPlaybook.id, 'outline');

        // * Assert "Require new channel for all runs" toggle exists
        cy.findByTestId('new-channel-only-toggle').should('exist');

        // * Assert toggle is initially unchecked (default state)
        cy.findByTestId('new-channel-only-toggle').find('input').first().should('not.be.checked');

        // * Assert via API that new_channel_only defaults to false
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            expect(pb.new_channel_only).to.equal(false);
        });
    });

    it('disables the "Link to existing channel" radio and selector in the editor when new_channel_only is true', () => {
        // # Enable new_channel_only via API
        cy.apiUpdatePlaybook({...testPlaybook, new_channel_only: true}).then(() => {
            // # Visit the playbook outline editor
            cy.visitPlaybookEditor(testPlaybook.id, 'outline');

            // * Assert the "Link to existing channel" radio is disabled
            cy.findByTestId('playbook-link-existing-channel-radio').should('be.disabled');

            // * Assert the channel selector is also disabled
            cy.get('#link_existing_channel_selector').
                closest('[id="link-existing-channel"]').
                find('.playbooks-rselect__control').
                should('have.class', 'playbooks-rselect__control--is-disabled');
        });
    });

    it('re-enables "Link to existing channel" radio when new_channel_only is turned off', () => {
        // # Enable then disable new_channel_only via API
        cy.apiUpdatePlaybook({...testPlaybook, new_channel_only: true}).
            then(() => cy.apiUpdatePlaybook({...testPlaybook, new_channel_only: false})).
            then(() => {
                cy.visitPlaybookEditor(testPlaybook.id, 'outline');

                // * Assert the radio is no longer disabled
                cy.findByTestId('playbook-link-existing-channel-radio').should('not.be.disabled');
            });
    });

    it('disables "Link to existing channel" controls after toggling new-channel-only on in the editor', () => {
        // # Visit the playbook outline editor with default state (new_channel_only=false)
        cy.visitPlaybookEditor(testPlaybook.id, 'outline');

        // # Click the toggle to enable new-channel-only
        cy.findByTestId('new-channel-only-toggle').click();

        // # Confirm the confirmation modal
        cy.get('#confirmModalButton').click();

        // * Assert the "Link to existing channel" radio is now disabled
        cy.findByTestId('playbook-link-existing-channel-radio').should('be.disabled');

        // * Assert the channel selector is also disabled
        cy.get('#link_existing_channel_selector').
            closest('[id="link-existing-channel"]').
            find('.playbooks-rselect__control').
            should('have.class', 'playbooks-rselect__control--is-disabled');

        // # Click the toggle again to disable new-channel-only (no confirmation needed)
        cy.findByTestId('new-channel-only-toggle').click();

        // * Assert the radio is no longer disabled
        cy.findByTestId('playbook-link-existing-channel-radio').should('not.be.disabled');
    });

    it('toggle persists new_channel_only=true after page reload', () => {
        // # Visit the playbook outline editor with default state (new_channel_only=false)
        cy.visitPlaybookEditor(testPlaybook.id, 'outline');

        // # Track playbook save request so we can wait for server-side persistence
        cy.playbooksInterceptPlaybookSave();

        // # Click the toggle to enable new-channel-only
        cy.findByTestId('new-channel-only-toggle').click();

        // # Confirm the confirmation modal and wait for the save to complete
        cy.playbooksConfirmModal();
        cy.wait('@SavePlaybook');

        // # Reload the editor to verify the value was persisted to the server
        cy.visitPlaybookEditor(testPlaybook.id, 'outline');

        // * Assert the toggle is still checked after reload
        cy.findByTestId('new-channel-only-toggle').find('input').first().should('be.checked');

        // * Assert via API that new_channel_only was persisted
        cy.apiGetPlaybook(testPlaybook.id).then((pb) => {
            expect(pb.new_channel_only).to.equal(true);
        });
    });
});
