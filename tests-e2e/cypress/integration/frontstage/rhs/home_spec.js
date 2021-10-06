// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbook run rhs > home', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Turn off growth onboarding screens
            cy.apiUpdateConfig({
                ServiceSettings: {EnableOnboardingFlow: false},
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('shows available', () => {
        it('team playbook', () => {
            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Team Playbook',
                memberIDs: [],
            });

            // # Navigate to the application
            cy.visit(`/${testTeam.name}/`);

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the playbook is shown
            cy.findByText('Your Playbooks')
                .next()
                .within(() => {
                    cy.findByText('Team Playbook').should('exist');
                });
        });
        it('starter templates', () => {
            // templates are defined in `webapp/src/components/backstage/template_selector.tsx`
            const templates = [
                {name: 'Blank', checklists: 'no checklists', actions: 'no actions'},
                {name: 'Product Release', checklists: '4 checklists', actions: '2 actions'},
                {name: 'Customer Onboarding', checklists: '4 checklists', actions: '2 actions'},
                {name: 'Service Reliability Incident', checklists: '4 checklists', actions: '3 actions'},
                {name: 'Feature Lifecycle', checklists: '5 checklists', actions: '2 actions'},
            ];

            // # Navigate to the application
            cy.visit(`/${testTeam.name}/`);

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the templates are shown
            cy.findByText('Playbook Templates')
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
});
