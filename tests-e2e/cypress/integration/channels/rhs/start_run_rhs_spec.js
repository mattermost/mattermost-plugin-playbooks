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
    let testPlaybook;
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
            cy.apiLogin(testUser).then(() => {
                cy.apiCreateChannel(testTeam.id, 'existing-channel', 'Existing Channel').then(({channel}) => {
                    testChannel = channel;
                });
            });
        });
    });

    after(() => {
        if (!featureFlagPrevValue) {
            cy.apiLogin(testSysadmin).then(() => {
                cy.apiEnsureFeatureFlag('linkruntoexistingchannelenabled', featureFlagPrevValue);
            });
        }
    });

    const createPlaybook = ({channelNameTemplate, runSummaryTemplate, channelId, channelMode}) => {
        const runSummaryTemplateEnabled = Boolean(runSummaryTemplate);

        // # Create a public playbook
        return cy.apiCreatePlaybook({
            channelNameTemplate,
            runSummaryTemplate,
            runSummaryTemplateEnabled,
            channelMode,
            channelId,
            teamId: testTeam.id,
            title: 'Public Playbook',
            makePublic: true,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        });
    };

    describe('playbook configured as create new channel', () => {
        it('defaults', () => {
            // Fill default values
            createPlaybook({
                channelNameTemplate: 'Channel template',
                runSummaryTemplate: 'run summary template',
                channelMode: 'create_new_channel'
            }).then((playbook) => {
                testPlaybook = playbook;
            });

            // # Visit the selected playbook
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Open playbooks RHS.
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // * Click start a run button
            cy.findAllByTestId('run-playbook').eq(0).click();

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

        it('change title/summary', () => {
            // Fill default values
            createPlaybook({
                channelNameTemplate: 'Channel template',
                runSummaryTemplate: 'run summary template',
                channelMode: 'create_new_channel'
            }).then((playbook) => {
                testPlaybook = playbook;
            });

            // # Visit the selected playbook
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Open playbooks RHS.
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // * Click start a run button
            cy.findAllByTestId('run-playbook').eq(0).click();

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

        it('change to link to existing channel', () => {
            // Fill default values
            createPlaybook({
                channelNameTemplate: 'Channel template',
                runSummaryTemplate: 'run summary template',
                channelMode: 'create_new_channel'
            }).then((playbook) => {
                testPlaybook = playbook;
            });

            // # Visit the selected playbook
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Open playbooks RHS.
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // * Click start a run button
            cy.findAllByTestId('run-playbook').eq(0).click();

            cy.get('#root-portal.modal-open').within(() => {
                // # wait the modal to render
                cy.wait(500);

                // * Change to link to existing channel
                cy.findByTestId('link-existing-channel-radio').click();

                // # Fill run name
                cy.findByTestId('run-name-input').clear().type('Test Run Name');

                // # assert cta is disabled
                cy.findByTestId('modal-confirm-button').should('be.disabled');

                // * fill Town square as the channel to be linked
                cy.findByText('Select a channel').click().type(`${testChannel.display_name}{enter}`);

                // * Click start button
                cy.findByTestId('modal-confirm-button').click();
            });

            // # verify we are on the channel just created
            cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

            // // # verify channel name
            cy.get('h2').contains(`Beginning of ${testChannel.display_name}`);

            // // # verify run RHS
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.contains('Test Run Name');
                cy.contains('run summary template');
            });
        });
    });

    // describe('pbe configured as linked to existing channel', () => {
    //     it('defaults', () => {
    //         // # Visit the selected playbook
    //         cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

    //         // Fill default values
    //         fillPBE({summary: 'run summary template', channelMode: 'link_to_existing_channel', channelNameToLink: 'Town'});

    //         // * Click start a run button
    //         cy.findByTestId('run-playbook').click();

    //         cy.get('#root-portal.modal-open').within(() => {
    //             // # wait the modal to render
    //             cy.wait(500);

    //             // # Assert template name is empty
    //             cy.findByTestId('run-name-input').should('be.empty');

    //             // # Assert template summary is filled
    //             cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

    //             // # assert button is still disabled
    //             cy.findByTestId('modal-confirm-button').should('be.disabled');

    //             // * Fill run name
    //             cy.findByTestId('run-name-input').clear().type('Test Run Name');

    //             // * Click start button
    //             cy.findByTestId('modal-confirm-button').click();
    //         });

    //         // # verify we are on RDP
    //         cy.url().should('include', '/playbooks/runs/');
    //         cy.url().should('include', '?from=run_modal');

    //         // # verify run name
    //         cy.get('h1').contains('Test Run Name');

    //         // # verify run summary
    //         cy.findByTestId('run-summary-section').contains('run summary template');

    //         // * click channel link
    //         cy.findByTestId('runinfo-channel-link').click();

    //         // # verify we are on town square
    //         cy.url().should('include', `/${testTeam.name}/channels/town-square`);
    //     });

    //     it('fill initially empty channel', () => {
    //         // # Visit the selected playbook
    //         cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

    //         // Fill default values
    //         fillPBE({summary: 'run summary template', channelMode: 'link_to_existing_channel'});

    //         // * Click start a run button
    //         cy.findByTestId('run-playbook').click();

    //         cy.get('#root-portal.modal-open').within(() => {
    //             // # wait the modal to render
    //             cy.wait(500);

    //             // # Assert template name is empty
    //             cy.findByTestId('run-name-input').should('be.empty');

    //             // # Assert template summary is filled
    //             cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

    //             // * Fill run name
    //             cy.findByTestId('run-name-input').clear().type('Test Run Name');

    //             // # assert button is still disabled
    //             cy.findByTestId('modal-confirm-button').should('be.disabled');

    //             // * fill Town square as the channel to be linked
    //             cy.findByText('Select a channel').click().type('Town{enter}');

    //             // * Click start button
    //             cy.findByTestId('modal-confirm-button').click();
    //         });

    //         // # verify we are on RDP
    //         cy.url().should('include', '/playbooks/runs/');
    //         cy.url().should('include', '?from=run_modal');

    //         // # verify run name
    //         cy.get('h1').contains('Test Run Name');

    //         // # verify run summary
    //         cy.findByTestId('run-summary-section').contains('run summary template');

    //         // * click channel link
    //         cy.findByTestId('runinfo-channel-link').click();

    //         // # verify we are on town square
    //         cy.url().should('include', `/${testTeam.name}/channels/town-square`);
    //     });

    //     it('change to create new channel', () => {
    //         // # Visit the selected playbook
    //         cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

    //         // Fill default values
    //         fillPBE({name: 'Channel template', summary: 'run summary template', channelMode: 'link_to_existing_channel', channelNameToLink: 'Town'});

    //         // * Click start a run button
    //         cy.findByTestId('run-playbook').click();

    //         cy.get('#root-portal.modal-open').within(() => {
    //             // # wait the modal to render
    //             cy.wait(500);

    //             // * Change to create new channel
    //             cy.findByTestId('create-channel-radio').click();

    //             // # Fill run name
    //             cy.findByTestId('run-name-input').clear().type('Test Run Name');

    //             // * Click start button
    //             cy.findByTestId('modal-confirm-button').click();
    //         });

    //         // # verify we are on RDP
    //         cy.url().should('include', '/playbooks/runs/');
    //         cy.url().should('include', '?from=run_modal');

    //         // # verify run name
    //         cy.get('h1').contains('Test Run Name');

    //         // * click channel link
    //         cy.findByTestId('runinfo-channel-link').click();

    //         // # verify we are on channel Test Run Name
    //         cy.url().should('include', `/${testTeam.name}/channels/test-run-name`);
    //     });
    // });
});
