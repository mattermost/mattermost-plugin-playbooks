// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

const RUN_NAME_MAX_LENGTH = 64;

describe('playbooks > start a run', {testIsolation: true}, () => {
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

    const fillPBE = ({name, summary, channelMode, channelNameToLink, defaultOwnerEnabled}) => {
        // # Set channel name template and/or channel mode via API to ensure changes are
        // # persisted before the run modal opens (PBE auto-save uses a 500ms debounce which
        // # can race with immediately opening the modal).
        if (name || channelMode) {
            if (channelNameToLink) {
                // # Search for the channel by display name to get its ID
                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/api/v4/teams/${testTeam.id}/channels/search`,
                    method: 'POST',
                    body: {term: channelNameToLink},
                }).then((resp) => {
                    expect(resp.body).to.have.length.greaterThan(0, `Channel "${channelNameToLink}" not found`);
                    const channel = resp.body[0];
                    cy.apiGetPlaybook(testPlaybook.id).then((fullPlaybook) => {
                        if (name) {
                            fullPlaybook.channel_name_template = name;
                        }
                        if (channelMode) {
                            fullPlaybook.channel_mode = channelMode === 'link_to_existing_channel' ? 'link_existing_channel' : channelMode;
                            fullPlaybook.channel_id = channel.id;
                        }
                        return cy.apiUpdatePlaybook(fullPlaybook);
                    });
                });
            } else {
                cy.apiGetPlaybook(testPlaybook.id).then((fullPlaybook) => {
                    if (name) {
                        fullPlaybook.channel_name_template = name;
                    }
                    if (channelMode) {
                        fullPlaybook.channel_mode = channelMode === 'link_to_existing_channel' ? 'link_existing_channel' : channelMode;
                    }
                    return cy.apiUpdatePlaybook(fullPlaybook);
                });
            }
            cy.reload();
        }

        // # fill summary template
        if (summary) {
            cy.contains('run summary template').click();
            cy.focused().type('run summary template');
            cy.findByRole('button', {name: /save/i}).click();
        }

        if (defaultOwnerEnabled) {
            cy.get('#assign-owner').within(() => {
                // TODO: add data-testid to Toggle's input in production code to avoid structural selector
                cy.get('label input').should('not.be.checked');
                cy.get('label input').click({force: true});
                cy.get('label input').should('be.checked');
            });
        }
    };
    describe('from playbook list', () => {
        it('defaults', () => {
            // # Visit playbook list
            cy.visit('/playbooks/playbooks');

            // # Click "Run" button on the first playbook
            cy.findAllByTestId('playbook-item').first().within(() => {
                cy.findByText('Run').click();
            });

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert template name is filled
                cy.findByTestId('run-name-input').clear().type('Run name');

                // # Click start button
                cy.findByTestId('modal-confirm-button').click();
            });

            // * Verify we are on RDP
            cy.url().should('include', '/playbooks/runs/');
            cy.url().should('include', '?from=run_modal');

            // * Verify run name
            cy.get('h1').contains('Run name');
        });
    });

    describe('from playbook editor', () => {
        describe('pbe configured as create new channel', () => {
            it('defaults', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template', channelMode: 'create_new_channel', defaultOwnerEnabled: true});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // * Assert template name is filled
                    cy.findByTestId('run-name-input').should('have.value', 'Channel template');

                    // * Assert template summary is filled
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Channel template');

                // * Verify run summary
                cy.findByTestId('run-summary-section').contains('run summary template');
            });

            it('change title/summary', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values (no channel_name_template so user-typed name is used)
                fillPBE({summary: 'run summary template', channelMode: 'create_new_channel'});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // * Assert summary is filled
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // # Fill run summary
                    cy.findByTestId('run-summary-input').clear().type('Test Run Summary');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // * Verify run summary
                cy.findByTestId('run-summary-section').contains('Test Run Summary');
            });

            it('change to link to existing channel does not default to current channel', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template', channelMode: 'create_new_channel', defaultOwnerEnabled: true});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Change to link to existing channel
                    cy.findByTestId('link-existing-channel-radio').click();

                    // * Assert selected channel is unchanged
                    cy.findByText('Select a channel').should('be.visible');
                });
            });

            it('switching to link existing defaults to current channel when no channel is pre-configured', () => {
                // # Visit a known channel first to set the current channel context in Redux
                cy.visit(`/${testTeam.name}/channels/town-square`);
                cy.get('#channelHeaderTitle').should('be.visible');

                // # Navigate to the playbook editor via client-side routing (no full page reload),
                // # preserving the Redux currentChannelId set by visiting town-square above.
                cy.window().then((win) => {
                    win.WebappUtils.browserHistory.push(`/playbooks/playbooks/${testPlaybook.id}/outline`);
                });
                cy.url().should('include', `/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Switch to link existing channel mode
                    cy.findByTestId('link-existing-channel-radio').click();

                    // * Verify Town Square is pre-selected because it was the active channel
                    cy.findByText('Town Square').should('be.visible');
                    cy.findByText('Select a channel').should('not.exist');
                });
            });

            it('change to link to existing channel', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values (no channel_name_template so user-typed name is used)
                fillPBE({summary: 'run summary template', channelMode: 'create_new_channel', defaultOwnerEnabled: true});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Change to link to existing channel
                    cy.findByTestId('link-existing-channel-radio').click();

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // * Assert cta is disabled
                    cy.findByTestId('modal-confirm-button').should('be.disabled');

                    // # Fill Town square as the channel to be linked
                    cy.findByText('Select a channel').click().type('Town{enter}');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // # Click channel link
                cy.findByTestId('runinfo-channel-link').click();

                // * Verify we are on town square
                cy.url().should('include', `/${testTeam.name}/channels/town-square`);
            });
        });

        describe('pbe configured as linked to existing channel', () => {
            it('defaults', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values
                fillPBE({summary: 'run summary template', channelMode: 'link_to_existing_channel', channelNameToLink: 'Town'});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // * Assert template name is empty
                    cy.findByTestId('run-name-input').should('be.empty');

                    // * Assert template summary is filled
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // * Assert button is still disabled
                    cy.findByTestId('modal-confirm-button').should('be.disabled');

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // * Verify run summary
                cy.findByTestId('run-summary-section').contains('run summary template');

                // # Click channel link
                cy.findByTestId('runinfo-channel-link').click();

                // * Verify we are on town square
                cy.url().should('include', `/${testTeam.name}/channels/town-square`);
            });

            it('fill initially empty channel', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values
                fillPBE({summary: 'run summary template', channelMode: 'link_to_existing_channel'});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // * Assert template name is empty
                    cy.findByTestId('run-name-input').should('be.empty');

                    // * Assert template summary is filled
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // * Assert button is still disabled
                    cy.findByTestId('modal-confirm-button').should('be.disabled');

                    // # Fill Town square as the channel to be linked
                    cy.findByText('Select a channel').click().type('Town{enter}');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // * Verify run summary
                cy.findByTestId('run-summary-section').contains('run summary template');

                // # Click channel link
                cy.findByTestId('runinfo-channel-link').click();

                // * Verify we are on town square
                cy.url().should('include', `/${testTeam.name}/channels/town-square`);
            });

            it('change to create new channel', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // Fill default values (no channel_name_template so user-typed name is used)
                fillPBE({summary: 'run summary template', channelMode: 'link_to_existing_channel', channelNameToLink: 'Town'});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // * Change to create new channel
                    cy.findByTestId('create-channel-radio').click();

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // # Click channel link
                cy.findByTestId('runinfo-channel-link').click();

                // * Verify we are on channel Test Run Name
                cy.url().should('include', `/${testTeam.name}/channels/test-run-name`);
            });
        });
    });

    describe('start run modal > invalid user input', () => {
        it('modal resets form fields when cancelled and reopened', () => {
            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Click start a run button
            cy.findByTestId('run-playbook').click();

            cy.get('#root-portal.modal-open').within(() => {
                // # Fill in custom values
                cy.findByTestId('run-name-input').type('Custom Run Name');
                cy.findByTestId('run-summary-input').type('Custom Summary');

                // # Cancel the modal
                cy.findByRole('button', {name: 'Cancel'}).click();
            });

            // * Verify modal is closed
            cy.get('#root-portal.modal-open').should('not.exist');

            // # Reopen the modal
            cy.findByTestId('run-playbook').click();

            cy.get('#root-portal.modal-open').within(() => {
                // * Verify fields are reset to defaults (empty — no template configured)
                cy.findByTestId('run-name-input').should('have.value', '');
                cy.findByTestId('run-summary-input').should('have.value', '');
            });
        });

        it('exactly max length run name is accepted', () => {
            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Click start a run button
            cy.findByTestId('run-playbook').click();

            cy.get('#root-portal.modal-open').within(() => {
                // # Type a run name of exactly the maximum allowed length
                cy.findByTestId('run-name-input').type('a'.repeat(RUN_NAME_MAX_LENGTH));

                // * Assert no validation error is shown
                cy.findByTestId('run-name-error').should('not.exist');

                // * Assert start button is enabled
                cy.findByTestId('modal-confirm-button').should('not.have.attr', 'disabled');
            });
        });

        it('submit button is disabled when run name is empty', () => {
            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Click start a run button
            cy.findByTestId('run-playbook').click();

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert template name is empty
                cy.findByTestId('run-name-input').should('have.value', '');

                // * Assert start button is disabled
                cy.findByTestId('modal-confirm-button').should('have.attr', 'disabled');
            });
        });

        it('error is shown when maximum length of run name is exceeded', () => {
            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Click start a run button
            cy.findByTestId('run-playbook').click();

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert template name is empty
                cy.findByTestId('run-name-input').should('have.value', '');

                // # Type run name that exceeds maximum length
                cy.findByTestId('run-name-input').type('a'.repeat(RUN_NAME_MAX_LENGTH + 1));

                // * Assert error shown and contains maximum length in message
                cy.findByTestId('run-name-error').should('contain', RUN_NAME_MAX_LENGTH);

                // * Assert start button is disabled
                cy.findByTestId('modal-confirm-button').should('have.attr', 'disabled');

                // # Delete last character via backspace
                cy.findByTestId('run-name-input').type('{backspace}');

                // * Assert that error is not shown anymore
                cy.findByTestId('run-name-error').should('not.exist');
            });
        });
    });
});
