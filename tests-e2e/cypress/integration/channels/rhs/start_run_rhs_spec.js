// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels rhs > start a run', () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let testChannel;
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

    describe('From RHS home  > ', () => {
        describe('playbook configured as create new channel', () => {
            it('defaults', () => {
                // Fill default values
                createPlaybook({
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel'
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // * Click start a run button
                    cy.get(`#pbitem-${playbook.id}`).findByTestId('run-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # wait the modal to render
                        cy.wait(500);

                        // # Assert template name is filled
                        cy.findByTestId('run-name-input').should('have.value', 'Channel template');

                        // # Assert summary template is filled
                        cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                        // * Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // # verify we are on the channel just created
                    cy.url().should('include', `/${testTeam.name}/channels/channel-template`);

                    // # verify channel name
                    cy.get('h2').contains('Beginning of Channel template');

                    // # verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Channel template');
                        cy.contains('run summary template');
                    });
                });
            });

            it('change title/summary', () => {
                // Fill default values
                createPlaybook({
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel'
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // * Click start a run button
                    cy.get(`#pbitem-${playbook.id}`).findByTestId('run-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # wait the modal to render
                        cy.wait(500);

                        // # Assert template are filled (and force wait to them)
                        cy.findByTestId('run-name-input').should('have.value', 'Channel template');

                        // # Assert summary template is filled
                        cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // # Fill run summary
                        cy.findByTestId('run-summary-input').clear().type('Test Run Summary');

                        // * Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // # verify we are on the channel just created
                    cy.url().should('include', `/${testTeam.name}/channels/test-run-name`);

                    // # verify channel name
                    cy.get('h2').contains('Beginning of Test Run Name');

                    // # verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Test Run Name');
                        cy.contains('Test Run Summary');
                    });
                });
            });

            it('change to link to existing channel', () => {
                // Fill default values
                createPlaybook({
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel'
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // * Click start a run button
                    cy.get(`#pbitem-${playbook.id}`).findByTestId('run-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # wait the modal to render
                        cy.wait(500);

                        // * Change to link to existing channel
                        cy.findByTestId('link-existing-channel-radio').click();

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // * fill Town square as the channel to be linked
                        cy.findByText('Select a channel').click().type(`${testChannel.display_name}{enter}`);

                        // * Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // # verify we are on the existing channel
                    cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

                    // # verify channel name
                    cy.get('h2').contains(`Beginning of ${testChannel.display_name}`);

                    // # verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });
        });

        describe('playbook configured as linked to existing channel', () => {
            it('defaults', () => {
                // Fill default values
                createPlaybook({
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'link_existing_channel',
                    channelId: testChannel.id,
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // * Click start a run button
                    cy.get(`#pbitem-${playbook.id}`).findByTestId('run-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # wait the modal to render
                        cy.wait(500);

                        // # Assert template name is empty
                        cy.findByTestId('run-name-input').should('be.empty');

                        // # Assert template summary is filled
                        cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                        // * Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // * Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // # verify we are on the existing channel
                    cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

                    // # verify channel name
                    cy.get('h2').contains(`Beginning of ${testChannel.display_name}`);

                    cy.get('#rhsContainer').should('exist').within(() => {
                        // # verify run RHS
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });

            it('fill initially empty channel', () => {
                // Fill default values
                createPlaybook({
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'link_existing_channel',
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // * Click start a run button
                    cy.get(`#pbitem-${playbook.id}`).findByTestId('run-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # wait the modal to render
                        cy.wait(500);

                        // # Assert template name is empty
                        cy.findByTestId('run-name-input').should('be.empty');

                        // # Assert template summary is filled
                        cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                        // * Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // * fill Town square as the channel to be linked
                        cy.findByText('Select a channel').click().type(`${testChannel.display_name}{enter}`);

                        // * Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // # verify we are on the existing channel
                    cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

                    // # verify channel name
                    cy.get('h2').contains(`Beginning of ${testChannel.display_name}`);

                    cy.get('#rhsContainer').should('exist').within(() => {
                        // # verify run RHS
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });

            it('change to create new channel', () => {
            // Fill default values
                createPlaybook({
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'link_existing_channel',
                    channelId: testChannel.id,
                }).then((playbook) => {
                // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // * Click start a run button
                    cy.get(`#pbitem-${playbook.id}`).findByTestId('run-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # wait the modal to render
                        cy.wait(500);

                        // * Change to create new channel
                        cy.findByTestId('create-channel-radio').click();

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // * Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // # verify we are on the channel just created
                    cy.url().should('include', `/${testTeam.name}/channels/test-run-name`);

                    // # verify channel name
                    cy.get('h2').contains('Beginning of Test Run Name');

                    cy.get('#rhsContainer').should('exist').within(() => {
                        // # verify run RHS
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });
        });
    });

    describe('From RHS Run list  > ', () => {
        let now;
        beforeEach(() => {
            now = Date.now();
            createPlaybook({
                title: 'Playbook title ' + now,
                channelNameTemplate: 'Channel template',
                runSummaryTemplate: 'run summary template',
                channelMode: 'create_new_channel'
            }).then((playbook) => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: 'the run name(' + Date.now() + ')',
                    ownerUserId: testUser.id,
                    channelId: testChannel.id,
                });
            });
        });

        it('created in a different target channel', () => {
            // # Visit the selected playbook
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Click back to go to run list
            cy.findByTestId('back-button').should('be.visible').click();

            // // * Click start a run button
            cy.findByTestId('rhs-runlist-start-run').click();

            cy.get('#root-portal.modal-open').within(() => {
                // # wait the modal to render
                cy.wait(500);

                // # Assert we are at playbooks tab
                cy.findByText('Select a playbook').should('be.visible');

                // # click on the playbook
                cy.findAllByText(`Playbook title ${now}`).eq(0).click();

                // # Assert we are at start run tab
                cy.findByText('Start a run').should('be.visible');

                // # Assert summary template is filled
                cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                // * Click start button
                cy.findByTestId('modal-confirm-button').click();
            });

            // # verify we are on the channel just created
            cy.url().should('include', `/${testTeam.name}/channels/channel-template`);

            // # verify channel name
            cy.get('h2').contains('Beginning of Channel template');

            // # verify run RHS
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.contains('Channel template');
                cy.contains('run summary template');
            });
        });

        it('created in the same channel', () => {
            // # Visit the selected playbook
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Click back to go to run list
            cy.findByTestId('back-button').should('be.visible').click();

            // // * Click start a run button
            cy.findByTestId('rhs-runlist-start-run').click();

            cy.get('#root-portal.modal-open').within(() => {
                // # wait the modal to render
                cy.wait(500);

                // # Assert we are at playbooks tab
                cy.findByText('Select a playbook').should('be.visible');

                // # click on the playbook
                cy.findAllByText(`Playbook title ${now}`).eq(0).click();

                // # Assert we are at start run tab
                cy.findByText('Start a run').should('be.visible');

                // # give time to load
                cy.wait(500);

                // * Change to link to existing channel
                cy.findByTestId('link-existing-channel-radio').click();

                // # Fill run name
                cy.findByTestId('run-name-input').clear().type('Test Run Name');

                // * fill Town square as the channel to be linked
                cy.findByText('Select a channel').click().type(`${testChannel.display_name}{enter}`);

                // # Assert summary template is filled
                cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                // * Click start button
                cy.findByTestId('modal-confirm-button').click();
            });

            // # verify we are on the same channel
            cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

            // # verify channel name
            cy.get('h2').contains(`Beginning of ${testChannel.display_name}`);

            // # verify run RHS is opened on the new run
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.contains('Test Run Name');
                cy.contains('run summary template');
            });
        });
    });
});
