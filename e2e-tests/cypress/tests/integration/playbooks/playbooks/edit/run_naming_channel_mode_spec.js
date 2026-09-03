// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../../utils';
import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('playbooks > edit > run naming channel mode', {testIsolation: true}, () => {
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

        // # Create a fresh playbook linked to an existing channel for each test
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Run Naming Channel Mode Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
            channelMode: 'link_existing_channel',
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

    it('keeps the run number prefix and run name template editable when linking to an existing channel', () => {
        // # Visit the playbook outline editor
        cy.visitPlaybookEditor(testPlaybook.id, 'outline');

        // * Assert the run number prefix input is not disabled
        cy.findByTestId('channel-access-run-number-prefix').scrollIntoView().should('not.be.disabled');

        // * Assert the run name template input is not disabled
        cy.findByTestId('channel-access-run-name-template-input').scrollIntoView().should('not.be.disabled');

        // * Assert the Insert variable button is visible
        cy.findByTestId('channel-access-run-name-template-insert-variable').scrollIntoView().should('be.visible');

        // * Assert the Lock run name checkbox is not disabled
        cy.findByTestId('channel-access-run-name-template-locked').scrollIntoView().find('input').should('not.be.disabled');
    });

    it('persists an edited run number prefix and run name template while linked to an existing channel', () => {
        // # Visit the playbook outline editor
        cy.visitPlaybookEditor(testPlaybook.id, 'outline');

        // # Intercept the REST PATCH so we can wait for a debounced field save to round-trip
        cy.playbooksInterceptPatchPlaybook();

        // # Type a run number prefix
        cy.findByTestId('channel-access-run-number-prefix').scrollIntoView().clear();
        cy.findByTestId('channel-access-run-number-prefix').type('INC');

        // * The input reflects the fully typed value (client-side truth, independent of debounce timing)
        cy.findByTestId('channel-access-run-number-prefix').should('have.value', 'INC');

        // # Wait for a debounced PATCH to round-trip; the field may save more than once while
        // # typing, so only the response status is checked here — the final persisted value is
        // # verified below via polling, which tolerates any earlier intermediate saves.
        cy.wait('@PatchPlaybook').its('response.statusCode').should('be.oneOf', [200, 204]);

        // # Type a run name template
        cy.findByTestId('channel-access-run-name-template-input').scrollIntoView().click();
        cy.findByTestId('channel-access-run-name-template-input').type('Incident');

        // * The input reflects the fully typed value
        cy.findByTestId('channel-access-run-name-template-input').should('have.value', 'Incident');

        cy.wait('@PatchPlaybook').its('response.statusCode').should('be.oneOf', [200, 204]);

        // * Assert the values persisted via the API, polling in case a later debounced save
        // * (e.g. one carrying an intermediate keystroke) is still in flight
        cy.waitUntil(
            () => cy.apiGetPlaybook(testPlaybook.id).then((pb) =>
                pb.run_number_prefix === 'INC' && pb.channel_name_template === 'Incident'),
            {timeout: TIMEOUTS.TEN_SEC, interval: TIMEOUTS.HALF_SEC, errorMsg: 'Run number prefix and run name template were not persisted'},
        );
    });

    it('keeps the Public/Private visibility and Configure channel controls disabled while linked to an existing channel', () => {
        // # Visit the playbook outline editor
        cy.visitPlaybookEditor(testPlaybook.id, 'outline');

        // * Assert the Public/Private radios remain disabled (channel-creation-only controls)
        cy.get('#create-new-channel').within(() => {
            cy.contains('label', 'Public').find('input[type="radio"]').should('be.disabled');
            cy.contains('label', 'Private').find('input[type="radio"]').should('be.disabled');
        });

        // * Assert the Configure channel button remains disabled
        cy.findByTestId('playbook-channel-actions-button').should('be.disabled');
    });
});
