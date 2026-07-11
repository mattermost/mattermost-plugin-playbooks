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

    describe('name field is not required when template is locked', () => {
        let seqTemplatePlaybook;

        beforeEach(() => {
            // # Create a playbook with a system-token-only template (no property fields required),
            // # with override NOT allowed so the template is authoritative (locked).
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'SeqTemplate PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{OWNER}', channel_name_template_locked: true}).then(() => {
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
                // * Assert run name input is read-only and pre-filled with the template
                cy.findByTestId('run-name-input').should('have.value', '{OWNER}');
                cy.findByTestId('run-name-input').should('have.attr', 'readonly');

                // * Assert Start run is enabled — the template drives naming, no required fields to fill
                cy.findByTestId('modal-confirm-button').should('not.be.disabled');
            });
        });

        it('creates the run using the template\'s resolved value, since the field is read-only', () => {
            cy.playbooksOpenRunModal(seqTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                cy.findByTestId('modal-confirm-button').should('not.be.disabled').click();
            });

            cy.url().should('include', '/playbooks/runs/');

            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    // * The resolved name must not contain the literal {OWNER} token
                    expect(run.name).to.not.include('{OWNER}');
                    expect(run.name).to.not.be.empty;
                });
            });
        });

        it('backend ignores a client-supplied name and uses the template when locked', () => {
            // # Because the modal's field is read-only, it always submits the raw template
            // # text unmodified — that alone can't prove the backend enforces the lock,
            // # since resolving that same text via the user-supplied-name path would produce
            // # an identical, equally non-empty, token-free result. Call the create-run API
            // # directly with a name that actually differs from the template to prove the
            // # backend ignores it when locked, rather than just happening to agree with it.
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: seqTemplatePlaybook.id,
                playbookRunName: 'Something Else Entirely',
                ownerUserId: testUser.id,
            }).then(({id: runId}) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.name).to.not.equal('Something Else Entirely');
                    expect(run.name).to.not.include('{OWNER}');
                    expect(run.name).to.not.be.empty;
                });
            });
        });
    });

    describe('name field is required when template exists but override is allowed (default)', () => {
        let unlockedTemplatePlaybook;

        beforeEach(() => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'UnlockedTemplate PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: '{OWNER} - Incident'}).then(() => {
                    unlockedTemplatePlaybook = playbook;
                });
            });
        });

        afterEach(() => {
            if (unlockedTemplatePlaybook) {
                cy.apiArchivePlaybook(unlockedTemplatePlaybook.id);
            }
        });

        it('shows an editable name field prefilled with the template and its resolved preview', () => {
            cy.apiGetPlaybook(unlockedTemplatePlaybook.id).then((pb) => {
                expect(pb.channel_name_template_locked).to.equal(false);
            });

            cy.playbooksOpenRunModal(unlockedTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * The field is editable and prefilled with the raw template as a suggestion —
                // * submitting it unedited still resolves correctly, since the backend resolves
                // * tokens in a user-supplied name the same way it resolves the template itself.
                cy.findByTestId('run-name-input').should('have.value', '{OWNER} - Incident');
                cy.findByTestId('run-name-input').should('not.have.attr', 'readonly');

                // * Preview reflects the resolved value, not the raw {OWNER} syntax
                cy.findByTestId('run-name-preview').should('exist');
                cy.findByTestId('run-name-preview').should('contain', 'Incident');
                cy.findByTestId('run-name-preview').should('not.contain', '{OWNER}');

                // * Submit is enabled with the prefilled default
                cy.findByTestId('modal-confirm-button').should('not.be.disabled');
            });
        });

        it('requires an explicit name and disables submit when the prefilled name is cleared', () => {
            cy.playbooksOpenRunModal(unlockedTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                cy.findByTestId('run-name-input').clear();
                cy.findByTestId('modal-confirm-button').should('be.disabled');
            });
        });

        it('creates the run with the typed name, not the template', () => {
            const runName = 'My Custom Run Name ' + getRandomId();

            cy.playbooksOpenRunModal(unlockedTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                cy.findByTestId('run-name-input').clear().type(runName);
                cy.findByTestId('modal-confirm-button').should('not.be.disabled').click();
            });

            cy.url().should('include', '/playbooks/runs/');
            cy.get('h1').contains(runName);

            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.name).to.equal(runName);
                });
            });
        });

        it('resolves a token typed freehand into the name, not just tokens from the template', () => {
            cy.playbooksOpenRunModal(unlockedTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                cy.findByTestId('run-name-input').clear().type('Kickoff by {OWNER}', {parseSpecialCharSequences: false});

                // * The live preview reflects the resolved token, not the raw {OWNER} syntax
                cy.findByTestId('run-name-preview').should('exist');
                cy.findByTestId('run-name-preview').should('contain', 'Kickoff by');
                cy.findByTestId('run-name-preview').should('not.contain', '{OWNER}');

                cy.findByTestId('modal-confirm-button').should('not.be.disabled').click();
            });

            cy.url().should('include', '/playbooks/runs/');

            // * Backend resolved the token the same way it resolves a locked template's tokens
            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.name).to.not.include('{OWNER}');
                    expect(run.name).to.include('Kickoff by');
                });
            });
        });
    });

    describe('literal template (no variable) always allows override, even when explicitly locked', () => {
        let literalTemplatePlaybook;

        beforeEach(() => {
            // # A purely literal template (no {token}) with override explicitly set to false —
            // # simulating an admin who tried to lock it. The backend forces override-allowed
            // # to true regardless: locking a literal string would just force every run to the
            // # exact same fixed name, so the flag is a no-op here.
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'LiteralTemplate PB ' + getRandomId(),
                makePublic: true,
                memberIDs: [testUser.id],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'Incident War Room', channel_name_template_locked: true}).then(() => {
                    literalTemplatePlaybook = playbook;
                });
            });
        });

        afterEach(() => {
            if (literalTemplatePlaybook) {
                cy.apiArchivePlaybook(literalTemplatePlaybook.id);
            }
        });

        it('shows an editable name field despite the stored lock, since there is no valid variable to lock', () => {
            cy.apiGetPlaybook(literalTemplatePlaybook.id).then((pb) => {
                expect(pb.channel_name_template).to.equal('Incident War Room');
                expect(pb.channel_name_template_locked).to.equal(true);
            });

            cy.playbooksOpenRunModal(literalTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                // * Prefilled with the literal template, but NOT read-only despite the stored lock
                cy.findByTestId('run-name-input').should('have.value', 'Incident War Room');
                cy.findByTestId('run-name-input').should('not.have.attr', 'readonly');

                // * No preview — a literal template has no token to resolve
                cy.findByTestId('run-name-preview').should('not.exist');

                // * Submit is enabled with the prefilled default
                cy.findByTestId('modal-confirm-button').should('not.be.disabled');
            });
        });

        it('creates the run with the edited name, not forced to the stored template', () => {
            const runName = 'Custom Literal Run ' + getRandomId();

            cy.playbooksOpenRunModal(literalTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                cy.findByTestId('run-name-input').clear().type(runName);
                cy.findByTestId('modal-confirm-button').should('not.be.disabled').click();
            });

            cy.url().should('include', '/playbooks/runs/');
            cy.get('h1').contains(runName);

            cy.playbooksGetRunIdFromUrl().then((runId) => {
                cy.apiGetPlaybookRun(runId).then(({body: run}) => {
                    expect(run.name).to.equal(runName);
                });
            });
        });

        it('requires an explicit name and disables submit when the prefilled name is cleared', () => {
            cy.playbooksOpenRunModal(literalTemplatePlaybook.id);

            cy.get('#root-portal.modal-open').within(() => {
                cy.findByTestId('run-name-input').clear();
                cy.findByTestId('modal-confirm-button').should('be.disabled');
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

                // # 65-char template (plus {SEQ}) exceeds the 64-char run name limit. Includes a
                // # valid variable and is locked (override not allowed) — a purely literal
                // # template always allows override and would never hit this validation path.
                cy.apiPatchPlaybook(playbook.id, {channel_name_template: 'x'.repeat(65) + '{SEQ}', channel_name_template_locked: true});
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
