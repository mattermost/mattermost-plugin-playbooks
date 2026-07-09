// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > backstage detail > DM/GM checklist', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let dmPartner;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a DM partner used across tests
            cy.apiCreateUser().then(({user: partner}) => {
                dmPartner = partner;
                cy.apiAddUserToTeam(testTeam.id, dmPartner.id);
            });
        });
    });

    beforeEach(() => {
        cy.viewport('macbook-13');
        cy.apiLogin(testUser);
    });

    it('direct fetch loads backstage detail page for DM/GM checklist', () => {
        cy.apiCreateUser().then(({user: freshPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, freshPartner.id);

            cy.apiCreateDirectChannel([testUser.id, freshPartner.id]).then(({channel: dmChannel}) => {
                // # Create a DM checklist via the RHS
                cy.visit(`/${testTeam.name}/messages/@${freshPartner.username}`);
                cy.get('#post_textbox').should('exist');
                cy.getPlaybooksAppBarIcon().should('exist').click();
                cy.get('[data-testid="no-active-runs"]').should('be.visible');
                cy.get('[data-testid="no-active-runs"]').find('[data-testid="create-blank-checklist"]').click();
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Untitled checklist').should('be.visible');
                });

                // # Fetch run ID via API, filtered by channel to avoid matching earlier teamless runs
                cy.apiGetAllPlaybookRuns('').then((response) => {
                    const runs = response.body.items || [];
                    const dmRun = runs.find((r) => r.channel_id === dmChannel.id);
                    expect(dmRun).to.exist;

                    // # Navigate directly to the backstage detail page by run ID
                    cy.visit(`/playbooks/runs/${dmRun.id}`);

                    // * Verify the run header section is rendered
                    cy.findByTestId('run-header-section').should('be.visible');

                    // * Verify the page contains the run name
                    cy.findByTestId('run-header-section').contains('Untitled checklist');

                    // * Verify the summary section renders
                    cy.findByTestId('run-summary-section').should('be.visible');
                });
            });
        });
    });

    it('overview panel shows Owner, Participants, and Followers entries', () => {
        cy.apiCreateUser().then(({user: freshPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, freshPartner.id);

            cy.apiCreateDirectChannel([testUser.id, freshPartner.id]).then(({channel: dmChannel}) => {
                cy.visit(`/${testTeam.name}/messages/@${freshPartner.username}`);
                cy.get('#post_textbox').should('exist');
                cy.getPlaybooksAppBarIcon().should('exist').click();
                cy.get('[data-testid="no-active-runs"]').should('be.visible');
                cy.get('[data-testid="no-active-runs"]').find('[data-testid="create-blank-checklist"]').click();
                cy.get('#rhsContainer').should('exist').within(() => {
                    cy.findByText('Untitled checklist').should('be.visible');
                });

                // # Fetch run ID via API, filtered by channel to avoid matching earlier teamless runs
                cy.apiGetAllPlaybookRuns('').then((response) => {
                    const runs = response.body.items || [];
                    const dmRun = runs.find((r) => r.channel_id === dmChannel.id);
                    expect(dmRun).to.exist;

                    // # Navigate directly to backstage detail
                    cy.visit(`/playbooks/runs/${dmRun.id}`);

                    // * Verify Owner entry shows testUser
                    cy.findByTestId('runinfo-owner').should('be.visible').contains(testUser.username);

                    // * Verify Participants entry is rendered
                    cy.findByTestId('runinfo-participants').should('be.visible');

                    // * Verify Followers/Following entry is rendered
                    cy.findByTestId('runinfo-following').should('be.visible');
                });
            });
        });
    });

    /**
     * Helper: create a fresh DM partner + checklist run via API, then yield
     * the run object so each test starts from a known clean state without
     * relying on the empty-state RHS UI.
     */
    const setupFreshDMChecklist = (callback) => {
        cy.apiCreateUser().then(({user: freshPartner}) => {
            cy.apiAddUserToTeam(testTeam.id, freshPartner.id);
            cy.apiCreateDirectChannel([testUser.id, freshPartner.id]).then(({channel}) => {
                cy.apiRunPlaybook({
                    teamId: '',
                    playbookId: '',
                    playbookRunName: 'rdp-dm-' + Date.now(),
                    ownerUserId: testUser.id,
                    channelId: channel.id,
                }).then((run) => {
                    callback({freshPartner, channel, run});
                });
            });
        });
    };

    it('channel link in RHS Info shows DM partner display name', () => {
        setupFreshDMChecklist(({freshPartner, run}) => {
            cy.visit(`/playbooks/runs/${run.id}`);

            cy.findByTestId('runinfo-channel-link').should('be.visible');
            cy.findByTestId('runinfo-channel-link').should('contain.text', freshPartner.username);
            cy.findByTestId('runinfo-channel-link').should(
                'have.attr',
                'href',
                `/${testTeam.name}/messages/@${freshPartner.username}`,
            );
        });
    });

    it('clicking channel link navigates to DM conversation', () => {
        setupFreshDMChecklist(({freshPartner, run}) => {
            cy.visit(`/playbooks/runs/${run.id}`);

            cy.findByTestId('runinfo-channel-link').should('be.visible').click();

            cy.url().should('include', `/${testTeam.name}/messages/@${freshPartner.username}`);
            cy.get('#post_textbox').should('exist');
        });
    });

    it('Recent Activity panel has entries after checking a task', () => {
        setupFreshDMChecklist(({freshPartner, run}) => {
            // # Add a task via the channel RHS so a TaskStateModified event is created
            cy.visit(`/${testTeam.name}/messages/@${freshPartner.username}`);
            cy.get('#post_textbox').should('exist');
            cy.getPlaybooksAppBarIcon().should('exist').click();

            // # If a list view appears, click into the run; else assume detail view
            cy.get('body').then(($body) => {
                if ($body.find('[data-testid="run-list-card"]').length) {
                    cy.findAllByTestId('run-list-card').first().click();
                }
            });

            const taskTitle = 'Activity task ' + Date.now();
            cy.addNewTaskFromRHS(taskTitle);
            cy.findByText(taskTitle).parents('[data-testid="checkbox-item-container"]').within(() => {
                cy.get('input[type="checkbox"]').click();
                cy.get('input[type="checkbox"]').should('be.checked');
            });

            // # Navigate to the backstage detail page
            cy.visit(`/playbooks/runs/${run.id}`);

            // * Recent Activity section is rendered with at least one entry
            cy.findByTestId('rhs-timeline').should('exist');
            cy.findByTestId('rhs-timeline').find('li').should('have.length.at.least', 1);
        });
    });

    it('Timeline panel shows entries when opened from backstage detail', () => {
        setupFreshDMChecklist(({run}) => {
            cy.visit(`/playbooks/runs/${run.id}`);

            // # Click "View all" in Recent Activity. The link uses an opacity
            //   transition so we click via {force: true}; this matches the
            //   pattern used by other rdp specs.
            cy.findByTestId('rhs-timeline').should('exist');
            cy.findByText('View all').click({force: true}); // eslint-disable-line cypress/no-force

            // * RHS title switched to Timeline
            cy.findByTestId('rhs-title').contains('Timeline');
            cy.findByTestId('rhs-back-button').should('exist');
            cy.findByTestId('timeline-view').should('exist');
        });
    });

    it('Save as playbook from DM checklist navigates to new playbook outline', () => {
        setupFreshDMChecklist(({run}) => {
            cy.visit(`/playbooks/runs/${run.id}`);

            cy.findByTestId('run-header-section').should('be.visible');

            // # Open the run header's kebab/dropdown menu
            cy.findByTestId('run-header-section').findByTestId('menuButton').should('be.visible').click();

            cy.findByTestId('dropdownmenu').findByText('Save as playbook').should('be.visible').click();

            // * URL navigated to the new playbook's outline
            cy.url().should('match', /\/playbooks\/playbooks\/[a-z0-9]+\/outline/);
        });
    });

    it('hard refresh keeps team context after navigating to DM checklist detail', () => {
        setupFreshDMChecklist(({freshPartner, run}) => {
            cy.visit(`/playbooks/runs/${run.id}`);
            cy.findByTestId('run-header-section').should('be.visible');

            cy.reload();
            cy.findByTestId('run-header-section').should('be.visible');

            // * The team-fallback fix populates currentTeam.name into the
            //   channel link's team prefix even on a hard refresh of a
            //   teamless DM/GM run page. If the fallback fails, the href
            //   would be missing the team prefix.
            cy.findByTestId('runinfo-channel-link').should(
                'have.attr',
                'href',
                `/${testTeam.name}/messages/@${freshPartner.username}`,
            );
        });
    });

    // -----------------------------------------------------------
    // Regression for `397d5d3f` — Owner / Participants / Followers
    // sections must render on the backstage detail page for a
    // SELF-DM checklist (previously hidden by an isSelfDM check).
    // -----------------------------------------------------------
    it('overview panel renders Owner, Participants, and Followers for self-DM checklist (regression 397d5d3f)', () => {
        cy.apiCreateDirectChannel([testUser.id, testUser.id]).then(({channel}) => {
            cy.apiRunPlaybook({
                teamId: '',
                playbookId: '',
                playbookRunName: 'Self-DM Backstage Run ' + Date.now(),
                ownerUserId: testUser.id,
                channelId: channel.id,
            }).then((run) => {
                cy.visit(`/playbooks/runs/${run.id}`);
                cy.assertRunDetailsPageRenderComplete(testUser.username);

                cy.findByTestId('runinfo-owner').should('be.visible');
                cy.findByTestId('runinfo-participants').should('be.visible');
                cy.findByTestId('runinfo-following').should('be.visible');

                // * Channel link resolves to the self-DM with the user's username
                //   (regression: self-DM display name comes from the user profile,
                //   not from the channel.name pair).
                cy.findByTestId('runinfo-channel-link').should(
                    'have.attr',
                    'href',
                    `/${testTeam.name}/messages/@${testUser.username}`,
                );
                cy.findByTestId('runinfo-channel-link').should('contain.text', testUser.username);
            });
        });
    });
});
