// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > DM/GM run actions', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
            cy.apiLogin(testUser);
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    /**
     * Helper: create a DM with a fresh partner + a checklist run via API,
     * then navigate to the BACKSTAGE detail page (where the Run Actions
     * header button lives — channel RHS does not surface it directly).
     *
     * The RunActionsModal uses `useEnsureChannel` to actively load the
     * channel into the redux store, so this test does not need to navigate
     * through the DM first to pre-warm state.
     */
    const setupFreshDMRunActions = (callback) => {
        cy.apiCreateUser().then(({user: freshPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, freshPartner.id);
            cy.apiCreateDirectChannel([testUser.id, freshPartner.id]).then(({channel: dmChannel}) => {
                cy.apiRunPlaybook({
                    teamId: '',
                    playbookId: '',
                    playbookRunName: 'run-actions-dm-' + Date.now(),
                    ownerUserId: testUser.id,
                    channelId: dmChannel.id,
                }).then((run) => {
                    cy.visit(`/playbooks/runs/${run.id}`);
                    cy.findByTestId('run-header-section').should('be.visible');

                    callback({freshPartner, dmChannel, run});
                });
            });
        });
    };

    /**
     * Helper: open the Run Actions modal from the backstage run header.
     * The modal mounts with id="run-actions-modal" — use that to scope all
     * subsequent assertions and avoid matching other dialogs on the page.
     */
    const openRunActionsModal = () => {
        cy.findByTestId('rhs-header-button-run-actions').should('be.visible').click();
        cy.get('#run-actions-modal').should('be.visible');
    };

    /**
     * Helper: scope a callback within the Run Actions modal.
     */
    const withinRunActionsModal = (cb) => {
        cy.get('#run-actions-modal').within(cb);
    };

    /**
     * Helper: assert a single channel-membership Action row in the modal
     * shows the DM/GM hint and a disabled toggle. Both the hint and the
     * toggle live inside the Action's data-testid wrapper (via the
     * `hint` prop on Action), so the assertion is fully scoped to the
     * row under test.
     */
    const assertActionDisabledWithHint = (actionTestId) => {
        withinRunActionsModal(() => {
            cy.findByTestId(actionTestId).within(() => {
                // The hint is rendered into a modal portal whose effective
                // height varies during enter/leave animation, so assert on
                // existence + content rather than CSS visibility. The disabled
                // toggle is the load-bearing assertion.
                cy.contains('Not available for direct and group message channels').should('exist');
                cy.get('input[type="checkbox"]').should('be.disabled');
            });
        });
    };

    it('"Add to channel" action toggle is disabled with hint in DM', () => {
        setupFreshDMRunActions(() => {
            openRunActionsModal();
            assertActionDisabledWithHint('action-add-to-channel');
        });
    });

    it('"Remove from channel" action toggle is disabled with hint in DM', () => {
        setupFreshDMRunActions(() => {
            openRunActionsModal();
            assertActionDisabledWithHint('action-remove-from-channel');
        });
    });

    it('broadcast action is enabled in DM and the setting persists after save', () => {
        setupFreshDMRunActions(({run}) => {
            // # Give the run a broadcast destination; the server reports the flag as off without one
            cy.apiGetChannelByName(testTeam.name, 'town-square').then(({channel}) => {
                cy.apiUpdateRun(run.id, {broadcastChannelIDs: [channel.id]});
            });
            cy.reload();
            cy.findByTestId('run-header-section').should('be.visible');

            openRunActionsModal();

            // # Toggle broadcast on by clicking the action row's title — the
            //   toggle handler lives on the Action's clickable Container,
            //   not on the InvisibleInput directly, so a direct check() on
            //   the hidden input does not flip the React state.
            cy.findByTestId('action-broadcast-channels').within(() => {
                cy.get('label').first().click();
                cy.get('input[type="checkbox"]').should('be.checked');
            });

            // # Save the modal
            cy.get('#run-actions-modal').findByRole('button', {name: /save/i}).click();
            cy.get('#run-actions-modal').should('not.exist');

            // * Verify the broadcast-enabled flag is stored on the run
            cy.apiWaitForPlaybookRun(
                run.id,
                (r) => r.status_update_broadcast_channels_enabled === true,
                'Broadcast setting was not saved',
            );

            // * Verify the toggle is still on after a reload
            cy.reload();
            cy.findByTestId('run-header-section').should('be.visible');
            openRunActionsModal();
            cy.findByTestId('action-broadcast-channels').find('input[type="checkbox"]').should('be.checked');
        });
    });

    it('outgoing webhook action is enabled in DM and the setting persists after save', () => {
        setupFreshDMRunActions(({run}) => {
            openRunActionsModal();

            // # Toggle webhook on
            cy.findByTestId('action-outgoing-webhook').within(() => {
                cy.get('input[type="checkbox"]').should('not.be.disabled').check({force: true}); // eslint-disable-line cypress/no-force

                // # Enter a webhook URL into the textarea (PatternedTextArea)
                cy.get('textarea').clear().type('https://example.com/webhook');
            });

            // # Save the modal
            cy.get('#run-actions-modal').findByRole('button', {name: /save/i}).click();
            cy.get('#run-actions-modal').should('not.exist');

            // * Verify the run's webhook-enabled flag and URL are stored
            cy.apiWaitForPlaybookRun(
                run.id,
                (r) => r.status_update_broadcast_webhooks_enabled === true,
                'Webhook setting was not saved',
            ).then((savedRun) => {
                expect(savedRun.webhook_on_status_update_urls).to.deep.equal(['https://example.com/webhook']);
            });

            // * Verify the toggle and URL are still set after a reload
            cy.reload();
            cy.findByTestId('run-header-section').should('be.visible');
            openRunActionsModal();
            cy.findByTestId('action-outgoing-webhook').within(() => {
                cy.get('input[type="checkbox"]').should('be.checked');
                cy.get('textarea').should('have.value', 'https://example.com/webhook');
            });
        });
    });

    // -----------------------------------------------------------
    // TC4 (GM variant): Channel-membership toggles disabled in GM
    // -----------------------------------------------------------
    /**
     * Helper: create a GM with 3 members + a checklist run via API, then
     * navigate to the backstage detail page. Channel loading is handled
     * by the modal's `useEnsureChannel` hook.
     */
    const setupFreshGMRunActions = (callback) => {
        cy.apiCreateUser().then(({user: gmA}) => {
            cy.apiCreateUser().then(({user: gmB}) => {
                cy.apiAddUserToTeam(testTeam.id, gmA.id);
                cy.apiAddUserToTeam(testTeam.id, gmB.id);

                cy.apiCreateGroupChannel([testUser.id, gmA.id, gmB.id]).then(({channel: gmCh}) => {
                    cy.apiRunPlaybook({
                        teamId: '',
                        playbookId: '',
                        playbookRunName: 'run-actions-gm-' + Date.now(),
                        ownerUserId: testUser.id,
                        channelId: gmCh.id,
                    }).then((run) => {
                        cy.visit(`/playbooks/runs/${run.id}`);
                        cy.findByTestId('run-header-section').should('be.visible');
                        callback({gmCh, run});
                    });
                });
            });
        });
    };

    it('"Add to channel" action toggle is disabled with hint in GM', () => {
        setupFreshGMRunActions(() => {
            openRunActionsModal();
            assertActionDisabledWithHint('action-add-to-channel');
        });
    });

    it('"Remove from channel" action toggle is disabled with hint in GM', () => {
        setupFreshGMRunActions(() => {
            openRunActionsModal();
            assertActionDisabledWithHint('action-remove-from-channel');
        });
    });

    // NOTE: End-to-end status-update broadcast from a DM checklist (issuing
    // `/playbook update` and asserting on the broadcast channel) is intentionally
    // not covered here — `cy.updateStatus` opens the legacy AppsModal interactive
    // dialog in DM context, which uses a different testid surface. That flow
    // belongs in a dedicated DM-status-update spec. The tests above cover the
    // run actions modal itself, which is the scope of this file.
});
