// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels > rhs > home', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Team Playbook',
                memberIDs: [],
            });

            // # Create a public playbook with a channel name template
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Channel Name Template',
                memberIDs: [],
                channelNameTemplate: 'templated name',
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Navigate to the application, starting in a non-run channel.
        cy.visit(`/${testTeam.name}/`);
    });

    describe('shows available', () => {
        it('team playbooks', () => {
            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the playbook is shown
            cy.findByText('Your Playbooks')
                .parent()
                .next()
                .within(() => {
                    cy.findByText('Team Playbook').should('exist');
                });
        });

        it('starter templates', () => {
            // templates are defined in webapp/src/components/templates/template_data.tsx
            const templates = [
                {name: 'Blank', checklists: '1 checklist', actions: '1 action'},
                {name: 'Product Release', checklists: '4 checklists', actions: '3 actions'},
                {name: 'Customer Onboarding', checklists: '4 checklists', actions: '3 actions'},
                {name: 'Incident Resolution', checklists: '4 checklists', actions: '4 actions'},
                {name: 'Feature Lifecycle', checklists: '5 checklists', actions: '3 actions'},
                {name: 'Employee Onboarding', checklists: '5 checklists', actions: '2 actions'},
                {name: 'Bug Bash', checklists: '5 checklists', actions: '3 actions'},
            ];

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the templates are shown
            cy.findByText('Playbook Templates')
                .parent()
                .next()
                .within(() => {
                    cy.findAllByTestId('template-details').each(($templateElement, index) => {
                        cy.wrap($templateElement).within(() => {
                            cy.findByText(templates[index].name).should('exist');
                            cy.findByText(templates[index].checklists).should('exist');
                            cy.findByText(templates[index].actions).should('exist');
                        });
                    });
                });
        });
    });

    describe('runs playbook', () => {
        beforeEach(() => {
            // # Open RHS
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });
        });

        it('without pre-populated channel name template', () => {
            cy.findByText('Team Playbook').closest('[data-testid="rhs-home-item"]').find('[data-testid="run-playbook"]').click();

            cy.get('#interactiveDialogModal').within(() => {
                // * Verify run name prompt
                cy.get('input').eq(1).should('be.empty');
            });
        });

        it('with pre-populated channel name template', () => {
            cy.findByText('Channel Name Template').closest('[data-testid="rhs-home-item"]').find('[data-testid="run-playbook"]').click();

            cy.get('#interactiveDialogModal').within(() => {
                // * Verify run name prompt
                cy.get('input').eq(1).should('have.value', 'templated name');
            });
        });
    });
});
