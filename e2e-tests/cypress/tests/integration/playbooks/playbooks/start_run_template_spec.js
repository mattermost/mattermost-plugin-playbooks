// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('playbooks > start a run > template mode (React modal)', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    afterEach(() => {
        cy.apiLogin(testUser);
    });

    describe('name field is not required when template is set', () => {
        let seqTemplatePlaybook;

        beforeEach(() => {
            // # Create a playbook with a system-token-only template (no property fields required)
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'SeqTemplate PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{OWNER}'}).then(() => {
                    seqTemplatePlaybook = playbook;
                });
            });
        });

        afterEach(() => {
            if (seqTemplatePlaybook) {
                cy.apiArchivePlaybook(seqTemplatePlaybook.id);
            }
        });

        it('submit button is enabled even when name input shows template (no required fields)', () => {
            // * Verify via API that the playbook's channel_name_template includes {OWNER}
            cy.apiGetPlaybook(seqTemplatePlaybook.id).then((pb) => {
                expect(pb.channel_name_template).to.include('{OWNER}');
            });

            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(seqTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert run name input is pre-filled with the template
                cy.findByTestId('run-name-input').should('have.value', '{OWNER}');

                // * Assert Start run is enabled — the template drives naming, no required fields to fill
                cy.findByTestId('modal-confirm-button').should('not.be.disabled');
            });
        });
    });

    describe('many property fields — Cancel button remains reachable', () => {
        let manyFieldsPlaybook;

        beforeEach(() => {
            const fieldNames = ['Priority', 'Region', 'Team', 'Environment'];

            // # Create playbook, then add 4 fields and set template — all chained to keep async ordering correct
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'ManyFields PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                manyFieldsPlaybook = playbook;

                fieldNames.forEach((name, i) => {
                    cy.apiAddPropertyField(playbook.id, {
                        name,
                        type: 'text',
                        attrs: {visibility: 'always', sortOrder: i},
                    });
                });

                const template = fieldNames.map((n) => `{${n}}`).join(' - ');
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: template});
            });
        });

        afterEach(() => {
            if (manyFieldsPlaybook) {
                cy.apiArchivePlaybook(manyFieldsPlaybook.id);
            }
        });

        it('Cancel button is visible and clickable when modal shows many attribute inputs', () => {
            // # Open the Start Run modal
            cy.playbooksOpenRunModal(manyFieldsPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * All 4 attribute inputs are rendered
                cy.findByText('Attributes').should('be.visible');

                // * The Cancel button is visible within the viewport — not pushed off-screen
                cy.findByTestId('modal-cancel-button').should('be.visible');

                // # Click Cancel — modal should close without starting a run
                cy.findByTestId('modal-cancel-button').click();
            });

            // * Modal is gone after Cancel
            cy.get('#root-portal.modal-open').should('not.exist');
        });
    });

    describe('no-template free-text mode', () => {
        let plainPlaybook;

        beforeEach(() => {
            // # Create a playbook WITHOUT run_name_template
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Plain PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                plainPlaybook = playbook;
            });
        });

        afterEach(() => {
            if (plainPlaybook) {
                cy.apiArchivePlaybook(plainPlaybook.id);
            }
        });

        it('shows free-text name input without "(optional)" label', () => {
            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(plainPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert name input is visible
                cy.findByTestId('run-name-input').should('exist');

                // * Assert no "(optional)" label is shown
                cy.findByText('(optional)').should('not.exist');

                // * Assert no "Attributes" section is shown
                cy.findByText('Attributes').should('not.exist');

                // * Assert no name preview is shown
                cy.findByTestId('run-name-preview').should('not.exist');
            });
        });

        it('submit button is disabled when name is empty (no template)', () => {
            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(plainPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Assert name input is empty
                cy.findByTestId('run-name-input').should('have.value', '');

                // * Assert submit button is disabled
                cy.findByTestId('modal-confirm-button').should('be.disabled');
            });
        });

        it('submit enables and run is created when name is typed', () => {
            const runName = 'Manual Run ' + getRandomId();

            // # Open the modal from the playbook editor
            cy.playbooksOpenRunModal(plainPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // # Type a run name
                cy.findByTestId('run-name-input').clear().type(runName);

                // * Assert submit button is now enabled
                cy.findByTestId('modal-confirm-button').should('not.be.disabled');

                // # Submit
                cy.findByTestId('modal-confirm-button').click();
            });

            // * Verify we are on the run details page
            cy.url().should('include', '/playbooks/runs/');

            // * Verify run name
            cy.get('h1').contains(runName);

            // * Verify backend state: run name is stored correctly
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.name, 'run name should be stored server-side').to.equal(runName);
                });
            });
        });
    });

    describe('override the template-generated name', () => {
        let seqTemplatePlaybook;
        let plainPlaybook;
        let fieldTemplatePlaybook;
        let priorityFieldId;

        beforeEach(() => {
            // # Playbook with a system-token-only template (no property fields required)
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Override SeqTemplate PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{OWNER}'}).then(() => {
                    seqTemplatePlaybook = playbook;
                });
            });

            // # Playbook WITHOUT a template (free-text mode)
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Override Plain PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                plainPlaybook = playbook;
            });

            // # Playbook with a template referencing a required property field
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Override FieldTemplate PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                fieldTemplatePlaybook = playbook;
                cy.apiAddPropertyField(playbook.id, {
                    name: 'Priority',
                    type: 'text',
                    attrs: {visibility: 'always', sortOrder: 0},
                }).then((fieldId) => {
                    priorityFieldId = fieldId;
                });
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{Priority} incident'});
            });
        });

        afterEach(() => {
            [seqTemplatePlaybook, plainPlaybook, fieldTemplatePlaybook].forEach((pb) => {
                if (pb) {
                    cy.apiArchivePlaybook(pb.id);
                }
            });
        });

        it('does not show the override checkbox when no template is set', () => {
            // # Open the modal for a template-less playbook
            cy.playbooksOpenRunModal(plainPlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * The override checkbox is not rendered without a template
                cy.findByTestId('override-run-name-checkbox').should('not.exist');
            });
        });

        it('shows the override checkbox and toggles the name field editability', () => {
            // # Open the modal for a template playbook
            cy.playbooksOpenRunModal(seqTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Name input is pre-filled with the template and read-only
                cy.findByTestId('run-name-input').should('have.value', '{OWNER}').and('have.attr', 'readonly');

                // * The override checkbox exists and starts unchecked
                cy.findByTestId('override-run-name-checkbox').should('exist').and('not.be.checked');

                // # Check the override option
                cy.findByTestId('override-run-name-checkbox').check({force: true});

                // * Name input is now editable (no readonly attr) and cleared
                cy.findByTestId('run-name-input').should('have.value', '');
                cy.findByTestId('run-name-input').should('not.have.attr', 'readonly');

                // * The template preview is hidden while overriding
                cy.findByTestId('run-name-preview').should('not.exist');

                // # Uncheck the override option
                cy.findByTestId('override-run-name-checkbox').uncheck({force: true});

                // * The template is restored and the field is read-only again
                cy.findByTestId('run-name-input').should('have.value', '{OWNER}').and('have.attr', 'readonly');
            });
        });

        it('keeps the Start run button disabled when the override name is only whitespace', () => {
            // # Open the modal for a template playbook
            cy.playbooksOpenRunModal(seqTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // # Enable override
                cy.findByTestId('override-run-name-checkbox').check({force: true});

                // # Type only whitespace into the (now editable) name field
                cy.findByTestId('run-name-input').clear().type('   ');

                // * Start run stays disabled — a whitespace-only name is not a valid override.
                // The server trims the name and would otherwise fall back to the template, so the
                // client must not enable submission for whitespace-only input.
                cy.findByTestId('modal-confirm-button').should('be.disabled');
            });
        });

        it('creates a run with the manually-entered name when overriding a template', () => {
            const overrideName = 'Manually named run ' + getRandomId();

            // # Open the modal for a template playbook
            cy.playbooksOpenRunModal(seqTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // # Enable override and type a manual name
                cy.findByTestId('override-run-name-checkbox').check({force: true});
                cy.findByTestId('run-name-input').clear().type(overrideName);

                // * Submit is enabled and start the run
                cy.findByTestId('modal-confirm-button').should('not.be.disabled').click();
            });

            // * Landed on the run details page
            cy.url().should('include', '/playbooks/runs/');

            // * The run title matches the manually-entered name (not the {OWNER} template)
            cy.get('h1').contains(overrideName);

            // * Backend stored the overridden name verbatim and still assigned a sequential ID
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.name, 'run name should be the overridden value').to.equal(overrideName);
                    expect(run.sequential_id, 'a sequential ID is still assigned').to.not.equal('');
                });
            });
        });

        it('bypasses required template property fields when overriding', () => {
            const overrideName = 'Override skips fields ' + getRandomId();

            // # Open the modal for a playbook whose template requires a property field
            cy.playbooksOpenRunModal(fieldTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * The Attributes section (required field) is shown and submit is disabled
                cy.findByText('Attributes').should('be.visible');
                cy.findByTestId('modal-confirm-button').should('be.disabled');

                // # Enable override
                cy.findByTestId('override-run-name-checkbox').check({force: true});

                // * The Attributes section disappears — the template is no longer used
                cy.findByText('Attributes').should('not.exist');

                // # Type a manual name
                cy.findByTestId('run-name-input').clear().type(overrideName);

                // * Submit is enabled even though the required property field was never filled
                cy.findByTestId('modal-confirm-button').should('not.be.disabled').click();
            });

            // * Run is created with the overridden name
            cy.url().should('include', '/playbooks/runs/');
            cy.get('h1').contains(overrideName);
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.name).to.equal(overrideName);
                });
            });
        });

        it('does not persist attribute values typed before enabling override', () => {
            const overrideName = 'Override drops fields ' + getRandomId();
            const typedPriority = 'P1-' + getRandomId();

            // # Open the modal for a playbook whose template references a property field
            cy.playbooksOpenRunModal(fieldTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // # Fill the Priority attribute BEFORE enabling override
                cy.findByTestId(`property-field-${priorityFieldId}`).clear().type(typedPriority);

                // # Enable override (hides the Attributes section) and type a manual name
                cy.findByTestId('override-run-name-checkbox').check({force: true});
                cy.findByText('Attributes').should('not.exist');
                cy.findByTestId('run-name-input').clear().type(overrideName);

                // # Start the run
                cy.findByTestId('modal-confirm-button').should('not.be.disabled').click();
            });

            // * Run is created with the overridden name
            cy.url().should('include', '/playbooks/runs/');
            cy.get('h1').contains(overrideName);

            // * The value typed before overriding must NOT be persisted to the run
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.name).to.equal(overrideName);
                    expect(JSON.stringify(run.property_values || []), 'attribute value entered before override must not be persisted').to.not.contain(typedPriority);
                });
            });
        });
    });

    describe('template name too long', () => {
        let longTemplatePlaybook;

        beforeEach(() => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Long Template PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                longTemplatePlaybook = playbook;

                // # 65-char static template exceeds the 64-char run name limit
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'x'.repeat(65)});
            });
        });

        afterEach(() => {
            if (longTemplatePlaybook) {
                cy.apiArchivePlaybook(longTemplatePlaybook.id);
            }
        });

        it('shows inline error and disables submit when resolved run name exceeds 64 characters', () => {
            cy.playbooksOpenRunModal(longTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Inline error mentions the 64-character limit
                cy.findByTestId('run-name-preview-error').should('be.visible');
                cy.findByTestId('run-name-preview-error').should('contain', '64');

                // * Submit button is disabled
                cy.findByTestId('modal-confirm-button').should('be.disabled');
            });
        });
    });
});
