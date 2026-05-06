// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FIVE_SEC, TWO_SEC} from '../../../../../tests/fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels rhs > start a run', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        cy.apiCreateChannel(testTeam.id, 'existing-channel', 'Existing Channel').then(({channel}) => {
            testChannel = channel;
        });
    });

    const createPlaybook = ({channelNameTemplate, runSummaryTemplate, channelId, channelMode, title}) => {
        const runSummaryTemplateEnabled = Boolean(runSummaryTemplate);

        // # Create a public playbook
        return cy.apiCreatePlaybook({
            title: title || 'Public Playbook',
            channelNameTemplate,
            runSummaryTemplate,
            runSummaryTemplateEnabled,
            channelMode,
            channelId,
            teamId: testTeam.id,
            makePublic: true,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            cy.wrap(playbook);
        });
    };

    describe('From RHS run list  > ', () => {
        describe('playbook configured as create new channel', () => {
            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('defaults', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then(() => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Create a blank checklist
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();

                    // # Wait for checklist to be created and RHS to update to details view
                    cy.wait(2000);

                    // * Verify we're now in the RHS details view showing the new checklist
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.findByText('Untitled checklist').should('be.visible');
                        cy.findByText('Tasks').should('be.visible');
                    });
                });
            });

            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('change title/summary', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # First create a blank checklist so the header with dropdown appears
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                    cy.wait(1000); // Wait for checklist to be created and RHS to update

                    // # Now the header with dropdown should be visible, click the dropdown
                    cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

                    // # Click "Run a playbook" from the dropdown
                    cy.findByTestId('create-from-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert template are filled (and force wait to them)
                        cy.findByTestId('run-name-input').should('have.value', 'Channel template');

                        // * Assert summary template is filled
                        cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // # Fill run summary
                        cy.findByTestId('run-summary-input').clear().type('Test Run Summary');

                        // # Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // * Verify we are on the channel just created
                    cy.url().should('include', `/${testTeam.name}/channels/test-run-name`);

                    // * Verify channel name
                    cy.get('#channelHeaderTitle').contains('Test Run Name');

                    // * Verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Test Run Name');
                        cy.contains('Test Run Summary');
                    });
                });
            });

            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('change to link to existing channel defaults to current channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the town square channel
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # First create a blank checklist so the header with dropdown appears
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                    cy.wait(1000); // Wait for checklist to be created and RHS to update

                    // # Now the header with dropdown should be visible, click the dropdown
                    cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

                    // # Click "Run a playbook" from the dropdown
                    cy.findByTestId('create-from-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // # Change to link to existing channel
                        cy.findByTestId('link-existing-channel-radio').click();

                        // * Assert current channel is selected
                        cy.findByText('Town Square').should('be.visible');
                    });
                });
            });

            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('change to link to existing channel with already selected channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                    channelId: testChannel.id,
                }).then((playbook) => {
                    // # Visit the town square channel
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # First create a blank checklist so the header with dropdown appears
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                    cy.wait(1000); // Wait for checklist to be created and RHS to update

                    // # Now the header with dropdown should be visible, click the dropdown
                    cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

                    // # Click "Run a playbook" from the dropdown
                    cy.findByTestId('create-from-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // # Change to link to existing channel
                        cy.findByTestId('link-existing-channel-radio').click();

                        // * Assert selected channel is unchanged
                        cy.findByText(testChannel.display_name).should('be.visible');
                    });
                });
            });

            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('change to link to existing channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # First create a blank checklist so the header with dropdown appears
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                    cy.wait(1000); // Wait for checklist to be created and RHS to update

                    // # Now the header with dropdown should be visible, click the dropdown
                    cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

                    // # Click "Run a playbook" from the dropdown
                    cy.findByTestId('create-from-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // # Change to link to existing channel
                        cy.findByTestId('link-existing-channel-radio').click();

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // # Select test channel instead of current channel
                        cy.findByText('Town Square').click().type(`${testChannel.display_name}{enter}`);

                        // # Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // * Verify we are on the existing channel
                    cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

                    // * Verify channel name
                    cy.get('#channelHeaderTitle').contains(`${testChannel.display_name}`);

                    // * Verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });
        });
    });

    describe('DM/GM channel exclusion in run modal', () => {
        it('does not offer DM channels when linking an existing channel', () => {
            // # Setup: create a DM partner and ensure the DM exists
            cy.apiCreateUser().then(({user: dmPartner}) => {
                cy.apiAddUserToTeam(testTeam.id, dmPartner.id);
                cy.apiCreateDirectChannel([testUser.id, dmPartner.id]).then(({channel: dmCh}) => {
                    // # Create 2 checklists in the DM so list view shows
                    const ts = Date.now();
                    cy.apiRunPlaybook({teamId: '', playbookId: '', playbookRunName: 'DM Modal A ' + ts, ownerUserId: testUser.id, channelId: dmCh.id});
                    cy.apiRunPlaybook({teamId: '', playbookId: '', playbookRunName: 'DM Modal B ' + ts, ownerUserId: testUser.id, channelId: dmCh.id});

                    // # Create a playbook for the run modal
                    createPlaybook({
                        title: 'DM Modal Playbook ' + ts,
                        channelMode: 'link_existing_channel',
                        channelId: testChannel.id,
                    }).then((playbook) => {
                        // # Navigate to the DM and open RHS
                        cy.visit(`/${testTeam.name}/messages/@${dmPartner.username}`);
                        cy.get('#post_textbox').should('exist');
                        cy.getPlaybooksAppBarIcon().should('exist').click();

                        // * Verify list view
                        cy.findAllByTestId('run-list-card').should('have.length.at.least', 2);

                        // # Open the create dropdown and click "Run a playbook"
                        cy.findByTestId('create-blank-checklist').
                            parent().
                            find('.icon-chevron-down').
                            should('be.visible').
                            click();
                        cy.findByTestId('create-from-playbook').click();

                        // * Verify the run modal opened and select the playbook
                        cy.get('#root-portal.modal-open').within(() => {
                            cy.findByText(playbook.title).should('be.visible').click();

                            // # Switch to "Link to existing channel"
                            cy.findByTestId('link-existing-channel-radio').click();

                            // # Search for the DM partner in the channel selector
                            cy.get('#link-existing-channel-selector').click().type(dmPartner.username);

                            // * Verify the DM channel does NOT appear (excludeDMGM filters it)
                            cy.get('.playbooks-rselect__menu').within(() => {
                                cy.findByText(dmPartner.username).should('not.exist');
                            });
                        });

                        // # Close the modal
                        cy.get('body').type('{esc}');
                    });
                });
            });
        });
    });

    // -----------------------------------------------------------
    // Regression: opening the run modal from a DM/GM must NOT
    // pre-select the current channel (it's filtered as DM/GM) and
    // must NOT trigger a flood of getChannel(:id) requests.
    // -----------------------------------------------------------
    it('does not pre-select current DM and does not flood channel fetches', () => {
        cy.apiCreateUser().then(({user: dmPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, dmPartner.id);

            const ts = Date.now();
            const playbookTitle = 'DM Modal Playbook ' + ts;
            const playbook = createPlaybook({
                title: playbookTitle,
                channelMode: 'create_new_channel',
                channelNameTemplate: 'auto-' + ts,
            });

            playbook.then(() => {
                cy.apiCreateDirectChannel([testUser.id, dmPartner.id]).then(({channel: dmChannel}) => {
                    // # Intercept channel fetches before opening the modal
                    cy.intercept('GET', `/api/v4/channels/${dmChannel.id}*`).as('getDMChannel');

                    // # Visit the DM and open the run modal via the RHS
                    cy.visit(`/${testTeam.name}/messages/@${dmPartner.username}`);
                    cy.get('#post_textbox').should('exist');
                    cy.getPlaybooksAppBarIcon().should('exist').click();

                    cy.get('[data-testid="rhs-runs-list"], [data-testid="no-active-runs"]').should('exist');

                    // # Open the create dropdown and pick "Run a playbook"
                    cy.get('[data-testid="create-blank-checklist"]').
                        parent().
                        find('.icon-chevron-down').
                        should('be.visible').
                        click();
                    cy.get('[data-testid="create-from-playbook"]').click();

                    // # Open the run-playbook modal — pick the playbook
                    cy.get('#root-portal.modal-open').within(() => {
                        cy.findByText(playbookTitle).should('be.visible').click();

                        // # Switch to "Link to existing channel"
                        cy.findByTestId('link-existing-channel-radio').click();

                        // * No phantom "Unknown Channel" pill rendered as a value
                        cy.findByText('Unknown Channel').should('not.exist');
                    });

                    // * The DM channel was NOT fetched repeatedly (regression cap: <4 calls).
                    //   The fetch storm (when the bug exists) originates from
                    //   BroadcastChannelSelector mount and resolves within ~1s; TWO_SEC
                    //   leaves slack without inflating CI cost.
                    cy.wait(TWO_SEC); // eslint-disable-line cypress/no-unnecessary-waiting
                    cy.get('@getDMChannel.all').should('have.length.lessThan', 4);

                    // # Close
                    cy.get('body').type('{esc}');
                });
            });
        });
    });

    it('does not offer GM channels when linking an existing channel', () => {
        cy.apiCreateUser().then(({user: gmA}) => {
            cy.apiCreateUser().then(({user: gmB}) => {
                cy.apiAddUserToTeam(testTeam.id, gmA.id);
                cy.apiAddUserToTeam(testTeam.id, gmB.id);

                const ts = Date.now();
                const playbookTitle = 'GM Modal Playbook ' + ts;
                const playbook = createPlaybook({
                    title: playbookTitle,
                    channelMode: 'create_new_channel',
                    channelNameTemplate: 'gm-modal-' + ts,
                });

                playbook.then(() => {
                    cy.apiCreateGroupChannel([testUser.id, gmA.id, gmB.id]).then(({channel: gmChannel}) => {
                        cy.visit(`/${testTeam.name}/messages/${gmChannel.name}`);
                        cy.get('#post_textbox').should('exist');
                        cy.getPlaybooksAppBarIcon().should('exist').click();

                        cy.get('[data-testid="rhs-runs-list"], [data-testid="no-active-runs"]').should('exist');

                        cy.get('[data-testid="create-blank-checklist"]').
                            parent().
                            find('.icon-chevron-down').
                            should('be.visible').
                            click();
                        cy.get('[data-testid="create-from-playbook"]').click();

                        cy.get('#root-portal.modal-open').within(() => {
                            cy.findByText(playbookTitle).should('be.visible').click();
                            cy.findByTestId('link-existing-channel-radio').click();

                            // # Search by GM channel name fragment
                            cy.get('#link-existing-channel-selector').click().type(gmA.username);

                            // * The GM channel does NOT appear (excludeDMGM filters)
                            cy.get('.playbooks-rselect__menu').within(() => {
                                cy.findByText(gmA.username).should('not.exist');
                            });
                        });

                        cy.get('body').type('{esc}');
                    });
                });
            });
        });
    });
});
