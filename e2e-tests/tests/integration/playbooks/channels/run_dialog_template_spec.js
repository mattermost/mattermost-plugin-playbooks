// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

const PREVIEW_LABEL = 'Preview:';
const USER_ID_PATTERN = /\b[a-z0-9]{26}\b/;
const SELECT_USER_PLACEHOLDER = 'Select user...';

describe('channels > run dialog > template mode (RunPlaybookModal)', {testIsolation: true}, () => {
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

    it('name field is optional and Start run is enabled when channel_name_template is set', () => {
        const playbookTitle = 'Template Playbook ' + getRandomId();

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: playbookTitle,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'Default'}).then(() => {
                // # Navigate to the team and trigger the modal via slash command
                cy.visit(`/${testTeam.name}/channels/town-square`);
                cy.openPlaybookRunDialogFromSlashCommand();

                // * Verify the RunPlaybookModal opened (select-playbook step)
                cy.get('#playbooks_run_playbook_dialog').should('exist');

                // # Select the playbook
                cy.get('#playbooks_run_playbook_dialog').findByText(playbookTitle).click();

                // * Run name input should be visible but not required (template handles naming)
                cy.findByTestId('run-name-input').should('exist');

                // * Run name field should show "optional" indicator when template handles naming
                cy.get('#playbooks_run_playbook_dialog').within(() => {
                    cy.findByText(/optional/i).should('exist');
                });

                // * Start run button should be enabled even with blank name (template handles naming)
                cy.findByRole('button', {name: /start run/i}).should('not.be.disabled');
            });
        });
    });

    it('shows name preview when channel_name_template is set', () => {
        const playbookTitle = 'Preview Playbook ' + getRandomId();

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: playbookTitle,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'Default'}).then(() => {
                cy.visit(`/${testTeam.name}/channels/town-square`);
                cy.openPlaybookRunDialogFromSlashCommand();

                cy.get('#playbooks_run_playbook_dialog').findByText(playbookTitle).click();

                // * Name preview should be visible
                cy.findByTestId('run-name-preview').should('exist').and('contain', PREVIEW_LABEL);
            });
        });
    });

    it('name field is required when no channel_name_template is set', () => {
        const playbookTitle = 'Plain Playbook ' + getRandomId();

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: playbookTitle,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            cy.visit(`/${testTeam.name}/channels/town-square`);
            cy.openPlaybookRunDialogFromSlashCommand();

            cy.get('#playbooks_run_playbook_dialog').findByText(playbookTitle).click();

            // * Run name input should be required (no "optional" text)
            cy.get('#playbooks_run_playbook_dialog').within(() => {
                cy.findByTestId('run-name-input').should('exist');
                cy.findByText(/optional/i).should('not.exist');
            });

            // * Start run button should be disabled with blank name
            cy.findByRole('button', {name: /start run/i}).should('be.disabled');

            // # Fill in a name
            cy.findByTestId('run-name-input').type('My Run');

            // * Start run should now be enabled
            cy.findByRole('button', {name: /start run/i}).should('not.be.disabled');
        });
    });

    it('attribute fields appear for template-referenced properties', () => {
        const playbookTitle = 'Attrs Playbook ' + getRandomId();

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: playbookTitle,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Add a "Zone" text property field to the playbook
            cy.apiAddPropertyField(playbook.id, {name: 'Zone', type: 'text'}).then(() => {
                // Template references the Zone property field by name
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{Zone}'}).then(() => {
                    cy.visit(`/${testTeam.name}/channels/town-square`);
                    cy.openPlaybookRunDialogFromSlashCommand();

                    cy.get('#playbooks_run_playbook_dialog').findByText(playbookTitle).click();

                    cy.get('#playbooks_run_playbook_dialog').within(() => {
                        // * Attributes section should be visible
                        cy.findByText('Attributes').should('exist');

                        // * Zone label appears without a '*' — all shown fields are required
                        cy.contains('label', /Zone/).should('exist');
                        cy.contains('label', /Zone/).should('not.contain.text', '*');

                        // * Start run should be disabled until Zone is filled
                        cy.findByRole('button', {name: /start run/i}).should('be.disabled');
                    });
                });
            });
        });
    });

    it('user-type attribute field opens user picker on click and enables Start run after selection', () => {
        const playbookTitle = 'User Field Playbook ' + getRandomId();

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: playbookTitle,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Add a "Manager" user-type property field and reference it in the template
            cy.apiAddPropertyField(playbook.id, {name: 'Manager', type: 'user'}).then(() => {
                return cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{Manager} Incident'});
            }).then(() => {
                cy.visit(`/${testTeam.name}/channels/town-square`);
                cy.openPlaybookRunDialogFromSlashCommand();

                cy.get('#playbooks_run_playbook_dialog').findByText(playbookTitle).click();

                cy.get('#playbooks_run_playbook_dialog').within(() => {
                    // * Manager label should be visible with no '*'
                    cy.contains('label', /Manager/).should('exist');
                    cy.contains('label', /Manager/).should('not.contain.text', '*');

                    // * Start run should be disabled until Manager is filled
                    cy.findByRole('button', {name: /start run/i}).should('be.disabled');

                    // # Click "Select user..." to open the user picker
                    cy.findByText(SELECT_USER_PLACEHOLDER).click();
                });

                // * Wait for user picker options to render and select the test user by name
                cy.get('.playbook-react-select__option').should('have.length.greaterThan', 0);

                // # Select the test user by display name
                cy.get('.playbook-react-select__option').contains(testUser.username).click();

                cy.get('#playbooks_run_playbook_dialog').within(() => {
                    // * Start run should now be enabled
                    cy.findByRole('button', {name: /start run/i}).should('not.be.disabled');
                });
            });
        });
    });

    it('preview shows user display name (not user ID) after selecting a user-type attribute', () => {
        const playbookTitle = 'User Preview Playbook ' + getRandomId();

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: playbookTitle,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);
            cy.apiAddPropertyField(playbook.id, {name: 'Manager', type: 'user'}).then(() => {
                return cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{Manager} Incident'});
            }).then(() => {
                cy.visit(`/${testTeam.name}/channels/town-square`);
                cy.openPlaybookRunDialogFromSlashCommand();

                cy.get('#playbooks_run_playbook_dialog').findByText(playbookTitle).click();

                // # Open the user picker and select the test user by name
                cy.findByText(SELECT_USER_PLACEHOLDER).click();
                cy.get('.playbook-react-select__option').should('have.length.greaterThan', 0);
                cy.get('.playbook-react-select__option').contains(testUser.username).click();

                // * Preview must exist and contain "Incident" from the template
                cy.findByTestId('run-name-preview').should('contain', PREVIEW_LABEL).and('contain', 'Incident');

                // * Preview must contain the selected user's display name
                cy.findByTestId('run-name-preview').should('contain', testUser.username);

                // * Preview must not contain a raw 26-char alphanumeric Mattermost user ID —
                //   that was the bug: user ID shown instead of a human-readable display name.
                cy.findByTestId('run-name-preview').invoke('text').then((text) => {
                    expect(text).to.not.match(USER_ID_PATTERN);
                });
            });
        });
    });

    it('preview resolves {OWNER} to the current user display name (not a placeholder)', () => {
        const playbookTitle = 'Owner Preview Playbook ' + getRandomId();

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: playbookTitle,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // Template uses {OWNER} only (no {SEQ} to avoid needing a run_number_prefix)
            cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'Incident by {OWNER}'}).then(() => {
                cy.visit(`/${testTeam.name}/channels/town-square`);
                cy.openPlaybookRunDialogFromSlashCommand();

                cy.get('#playbooks_run_playbook_dialog').findByText(playbookTitle).click();

                // * Preview must appear immediately (no fields to fill — OWNER is a system token)
                cy.findByTestId('run-name-preview').should('exist').and('contain', PREVIEW_LABEL);

                // * Preview must contain the current user's display name (the run owner)
                cy.findByTestId('run-name-preview').should('contain', testUser.username);

                // * Preview must NOT show the generic "Owner's name" placeholder
                cy.findByTestId('run-name-preview').should('not.contain', "Owner's name");

                // * Preview must NOT contain a raw 26-char Mattermost user ID
                cy.findByTestId('run-name-preview').invoke('text').then((text) => {
                    expect(text).to.not.match(USER_ID_PATTERN);
                });
            });
        });
    });

    it('starts run with template-resolved name when required attribute is filled (slash command path)', () => {
        const playbookTitle = 'Region Template Playbook ' + getRandomId();

        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: playbookTitle,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            createdPlaybookIds.push(playbook.id);

            // # Add a "Region" text property field and set it as the run name template
            cy.apiAddPropertyField(playbook.id, {name: 'Region', type: 'text'}).then(() => {
                return cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{Region} Incident'});
            }).then(() => {
                // # Fetch field IDs so we can target the correct input
                cy.apiGetPropertyFields(playbook.id).then((fields) => {
                    const regionField = fields.find((f) => f.name === 'Region');

                    // # Navigate and open the run dialog via slash command
                    cy.visit(`/${testTeam.name}/channels/town-square`);
                    cy.openPlaybookRunDialogFromSlashCommand();

                    cy.get('#playbooks_run_playbook_dialog').findByText(playbookTitle).click();

                    // * Start run should be disabled until Region is filled
                    cy.findByRole('button', {name: /start run/i}).should('be.disabled');

                    // # Fill in the Region attribute field using its data-testid
                    cy.findByTestId(`property-field-${regionField.id}`).type('EMEA');

                    // * Start run should now be enabled
                    cy.findByRole('button', {name: /start run/i}).should('not.be.disabled');

                    // # Start the run
                    cy.findByRole('button', {name: /start run/i}).click();

                    // * Wait for modal to close
                    cy.get('#playbooks_run_playbook_dialog').should('not.exist');

                    // * Verify the run was created with the template-resolved name via API
                    cy.apiGetAllPlaybookRuns(testTeam.id).then((response) => {
                        const createdRun = response.body.items.find(
                            (r) => r.playbook_id === playbook.id && r.name && r.name.includes('EMEA'),
                        );
                        expect(createdRun, 'run with EMEA in name should exist').to.exist;
                        expect(createdRun.name).to.include('Incident');
                    });
                });
            });
        });
    });
});
