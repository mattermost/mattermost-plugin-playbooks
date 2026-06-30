// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

/* eslint-disable no-only-tests/no-only-tests */

describe('runs > run details page > status update', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;
    let playbookRunChannelName;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create another user in the same team
            cy.apiCreateUser().then(({user: viewer}) => {
                testViewerUser = viewer;
                cy.apiAddUserToTeam(testTeam.id, testViewerUser.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        playbookRunChannelName = 'playbook-run-' + now;

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);

            cy.assertRunDetailsPageRenderComplete(testUser.username);
        });
    });

    describe('as participant', () => {
        it('is visible', () => {
            // * Verify the status update section is present
            cy.findByTestId('run-statusupdate-section').should('be.visible');
        });

        it('has no title', () => {
            // * Verify the title
            cy.findByTestId('run-statusupdate-section').find('h3').should('not.exist');
        });

        describe('post update', () => {
            it('button disappears if we finish the run', () => {
                // * Check that post update button is visible
                cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').should('be.visible');

                // # Click finish button and confirm modal
                cy.findByTestId('run-finish-section').find('button').click();
                cy.get('#confirmModal').get('#confirmModalButton').click();

                // * Check that post update button does not exist anymore
                cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').should('not.exist');
            });

            it('button triggers post update modal', () => {
                // * Check due date
                cy.findByTestId('update-due-date-text').contains('Update due');
                cy.findByTestId('update-due-date-time').contains('in 24 hours');

                // # Click post update
                cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').click();

                // * Assert modal is opened
                cy.getStatusUpdateDialog().should('be.visible');

                // # Write message
                cy.findByTestId('update_run_status_textbox').clear().type('my nice update');
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('input').type('15 minutes', {delay: 200, force: true}).type('{enter}', {force: true});
                });

                // # Post update
                cy.getStatusUpdateDialog().findByTestId('modal-confirm-button').click();

                // * Check new due date
                cy.findByTestId('update-due-date-text').contains('Update due');
                cy.findByTestId('update-due-date-time').contains('in 15 minutes');

                // # go to channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * check that post has been added
                cy.getLastPost().contains('my nice update');
            });
        });

        describe('request an update', () => {
            it('is disabled if the run is finished', () => {
                cy.apiFinishRun(testRun.id).then(() => {
                    // # reload url
                    cy.visit(`/playbooks/runs/${testRun.id}`);
                    cy.assertRunDetailsPageRenderComplete(testUser.username);

                    // # Click on kebab menu
                    cy.findByTestId('run-statusupdate-section').getStyledComponent('Kebab').click();

                    // # click on request update option (force because is disabled)
                    cy.findByText('Request update...').click({force: true});

                    // * assert modal is not opened
                    cy.get('#confirmModalButton').should('not.exist');
                });
            });

            it('requests and confirm', () => {
                // # Click on kebab menu
                cy.findByTestId('run-statusupdate-section').getStyledComponent('Kebab').click();

                cy.findByTestId('dropdownmenu').within(($dropdown) => {
                    cy.wrap($dropdown).children().should('have.length', 2);

                    // # Click on request update
                    cy.findByText('Request update...').click();
                });

                // # Click on modal confirmation
                cy.get('#confirmModalButton').click();

                // # Go to channel
                cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Assert that message has been sent
                cy.getLastPost().contains(`${testUser.username} requested a status update for ${testRun.name}.`);
            });

            it('requests and cancel', () => {
                // # Click on kebab menu
                cy.findByTestId('run-statusupdate-section').getStyledComponent('Kebab').click();
                cy.findByTestId('dropdownmenu').within(($dropdown) => {
                    cy.wrap($dropdown).children().should('have.length', 2);

                    // # Click on request update
                    cy.findByText('Request update...').click();
                });

                // # Click on modal confirmation
                cy.get('#cancelModalButton').click();

                // # Go to channel
                cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Assert that message has not been sent
                cy.getLastPost().should('not.contain', `${testUser.username} requested a status update for ${testRun.name}.`);
            });
        });
    });

    describe('as viewer', () => {
        beforeEach(() => {
            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
                cy.assertRunDetailsPageRenderComplete(testUser.username);
            });
        });

        it('is visible', () => {
            // * Verify the status update section is present
            cy.findByTestId('run-statusupdate-section').should('be.visible');
        });

        it('has a title', () => {
            // * Verify the title
            cy.findByTestId('run-statusupdate-section').find('h3').contains('Recent status update');
        });

        it('has placeholder', () => {
            // * Verify the placeholder
            cy.findByTestId('run-statusupdate-section').find('i').contains('No updates have been posted yet');
        });

        it('has a due date', () => {
            // * Verify the due date
            cy.findByTestId('update-due-date-text').contains('Update due');
            cy.findByTestId('update-due-date-time').contains('in 24 hours');
        });

        it('shows the most recent update', () => {
            // # Login as participant
            cy.apiLogin(testUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
                cy.assertRunDetailsPageRenderComplete(testUser.username);
            });

            // # Click post update
            cy.findByTestId('run-statusupdate-section').
                should('be.visible').
                findByTestId('post-update-button').click();

            // * Assert modal is opened
            cy.getStatusUpdateDialog().should('be.visible');

            // # Write message
            cy.findByTestId('update_run_status_textbox').clear().type('my nice update');
            cy.get('#reminder_timer_datetime').within(() => {
                cy.get('input').type('15 minutes', {delay: 200, force: true}).type('{enter}', {force: true});
            });

            // # Post update
            cy.getStatusUpdateDialog().findByTestId('modal-confirm-button').click();

            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
                cy.assertRunDetailsPageRenderComplete(testUser.username);

                // * Check new due date
                cy.findByTestId('update-due-date-text').contains('Update due');
                cy.findByTestId('update-due-date-time').contains('in 15 minutes');

                // * Assert the recent updated text
                cy.findByTestId('status-update-card').contains('my nice update');
            });
        });

        it('requests an update and confirm', () => {
            // # Click on request update
            cy.findByTestId('run-statusupdate-section').
                should('be.visible').
                findByText('Request update...').click();

            // # Click on modal confirmation
            cy.get('#confirmModalButton').click();

            cy.apiLogin(testUser).then(() => {
                // # Go to channel
                cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Assert that message has been sent
                cy.getLastPost().contains(`${testViewerUser.username} requested a status update for ${testRun.name}.`);
            });
        });

        it('requests an update and cancel', () => {
            // # Click request update
            cy.findByTestId('run-statusupdate-section').
                should('be.visible').
                findByText('Request update...').click();

            // # Click on modal confirmation
            cy.get('#cancelModalButton').click();

            cy.apiLogin(testUser).then(() => {
                // # Go to channel
                cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Assert that message has been sent
                cy.getLastPost().should('not.contain', `${testUser.username} requested a status update for ${testPublicPlaybook.name}].`);
            });
        });
    });
});

describe('runs > run details page > status update > template token preview', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;

    before(() => {
        cy.apiAdminLogin();
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.viewport('macbook-13');
        cy.apiLogin(testUser);

        // # Create a fresh playbook per test so testPlaybook is always valid on retry/reload
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Template Preview Playbook ' + getRandomId(),
            memberIDs: [testUser.id],
            makePublic: true,
        }).then((playbook) => {
            testPlaybook = playbook;

            // # Set run_number_prefix so {SEQ} resolves to e.g. TPL-00001
            cy.apiPatchPlaybook(testPlaybook.id, {run_number_prefix: 'TPL'}).then(() => {
                // # Add a Zone select field with two options
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Zone',
                    type: 'select',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 0,
                        options: [
                            {name: 'Alpha'},
                            {name: 'Bravo'},
                        ],
                    },
                });
            });
        });

        // # Start a fresh run for each test (depends on testPlaybook set above)
        cy.then(() => cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: 'Template Preview Run ' + getRandomId(),
            ownerUserId: testUser.id,
        })).then((run) => {
            testRun = run;
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.assertRunDetailsPageRenderComplete(testUser.username);
        });
    });

    afterEach(() => {
        cy.apiLogin(testUser);
        if (testPlaybook) {
            cy.apiArchivePlaybook(testPlaybook.id);
        }
    });

    const openStatusUpdateModal = () => {
        cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').click();
        cy.getStatusUpdateDialog().should('be.visible');
    };

    const typeMessage = (msg) => {
        cy.findByTestId('update_run_status_textbox').clear().type(msg.replace(/{/g, '{{}'));
    };

    it('shows "Resolves to:" line when message contains {SEQ}', () => {
        openStatusUpdateModal();
        typeMessage('{SEQ} update');

        cy.findByTestId('status-message-preview').
            should('be.visible').
            and('contain', testRun.sequential_id).
            and('contain', ' update');
    });

    it('shows "Resolves to:" line when message contains {OWNER}', () => {
        openStatusUpdateModal();

        typeMessage('Owner is {OWNER}');

        // Verify token was resolved (don't assume display name format — depends on server TeammateNameDisplay setting)
        cy.findByTestId('status-message-preview').
            should('be.visible').
            and('contain', 'Owner is ').
            and('not.contain', '{OWNER}');
    });

    it('shows "Resolves to:" line for mixed system + unknown tokens — unknown token passed through', () => {
        openStatusUpdateModal();

        typeMessage('{SEQ} and {unknownfoo}');

        // * Preview shows: known token resolved, unknown token left as-is
        cy.findByTestId('status-message-preview').
            should('be.visible').
            and('contain', testRun.sequential_id).
            and('contain', '{unknownfoo}');
    });

    it('hides "Resolves to:" line when message has only unknown tokens', () => {
        openStatusUpdateModal();
        typeMessage('{unknownfoo}');

        // * No preview — nothing was resolved
        cy.findByTestId('status-message-preview').should('not.exist');
    });

    it('hides "Resolves to:" line for plain text with no tokens', () => {
        openStatusUpdateModal();
        typeMessage('just a plain update');

        cy.findByTestId('status-message-preview').should('not.exist');
    });

    it('shows "Resolves to:" for property field token after value is set', () => {
        // # Get the run-scoped Zone field id and set its value via GraphQL
        cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: `/plugins/playbooks/api/v0/runs/${testRun.id}/property_fields`,
            method: 'GET',
        }).then((response) => {
            const zoneField = response.body.find((f) => f.name === 'Zone');
            const alphaOptionId = zoneField.attrs.options.find((o) => o.name === 'Alpha').id;

            // # Set Zone = Alpha via GraphQL mutation
            const mutation = `mutation SetZone($runID: String!, $fieldID: String!, $value: JSON) {
                setRunPropertyValue(runID: $runID, propertyFieldID: $fieldID, value: $value)
            }`;
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json'},
                url: '/plugins/playbooks/api/v0/query',
                method: 'POST',
                body: {
                    operationName: 'SetZone',
                    query: mutation,
                    variables: {runID: testRun.id, fieldID: zoneField.id, value: alphaOptionId},
                },
            });
        });

        // # Reload the run page so the modal picks up the new value
        cy.reload();
        cy.assertRunDetailsPageRenderComplete(testUser.username);

        openStatusUpdateModal();
        typeMessage('Zone: {Zone}');

        cy.findByTestId('status-message-preview').
            should('be.visible').
            and('contain', 'Zone: Alpha');
    });
});
