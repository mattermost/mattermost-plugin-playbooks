// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > start a run', () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let testPlaybook;
    let featureFlagPrevValue;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateCustomAdmin().then(({sysadmin}) => {
                testSysadmin = sysadmin;
            });

            cy.apiEnsureFeatureFlag('linkruntoexistingchannelenabled', true).then(({prevValue}) => {
                featureFlagPrevValue = prevValue;
            });

            // # Login as testUser
            cy.apiLogin(testUser);
        });
    });

    after(() => {
        if (!featureFlagPrevValue) {
            cy.apiLogin(testSysadmin).then(() => {
                cy.apiEnsureFeatureFlag('linkruntoexistingchannelenabled', featureFlagPrevValue);
            });
        }
    });

    beforeEach(() => {
        // # Create a public playbook
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Public Playbook',
            makePublic: true,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            testPlaybook = playbook;
        });
    });

    const fillPBE = ({name, summary, channelMode}) => {
        // # fill channel name temaplte
        if (name) {
            cy.get('#create-new-channel input[type="text"]').clear().type('Channel template');
        }

        // # fill summary template
        if (summary) {
            cy.contains('run summary template').dblclick();
            cy.focused().type('run summary template');
            cy.findByRole('button', {name: /save/i}).click();
        }
        if (channelMode === 'create_new_channel') {
            cy.get('#create-new-channel input[type="radio"]').eq(0).click();
        } else if (channelMode === 'link_to_existing_channel') {
            cy.get('#link-existing-channel input[type="radio"]').click();
        }
    };

    describe('from playbook editor', () => {
        describe('can be started', () => {
            it('create new channel - defaults', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template', channelMode: 'create_new_channel'});

                // * Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Assert template name is filled
                    cy.findByTestId('run-name-input').should('have.value', 'Channel template');

                    // # Assert template summary is filled
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // * Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // # verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // # verify run name
                cy.get('h1').contains('Channel template');

                // # verify run summary
                cy.findByTestId('run-summary-section').contains('run summary template');
            });

            it('create new channel - change title/summary', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template'});

                // * Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Assert template are filled (and force wait to them)
                    cy.findByTestId('run-name-input').should('have.value', 'Channel template');
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // # Fill run summary
                    cy.findByTestId('run-summary-input').clear().type('Test Run Summary');

                    // * Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // # verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // # verify run name
                cy.get('h1').contains('Test Run Name');

                // # verify run summary
                cy.findByTestId('run-summary-section').contains('Test Run Summary');
            });

            it('can be linked to an existing channel even if it wasnt configured like that', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template'});

                // * Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // * Change to link to existing channel
                    cy.findByTestId('link-existing-channel-radio').click();

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // # assert cta is disabled
                    cy.findByTestId('modal-confirm-button').should('be.disabled');

                    // * fill Town square as the channel to be linked
                    cy.findByText('Select a channel').click().type('Town{enter}');

                    // * Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // # verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // # verify run name
                cy.get('h1').contains('Test Run Name');

                // * click channel link
                cy.findByTestId('runinfo-channel-link').click();

                // # verify we are on town square
                cy.url().should('include', `/${testTeam.name}/channels/town-square`);
            });
        });
    });
});
