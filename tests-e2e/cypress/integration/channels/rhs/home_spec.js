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
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Navigate to the application, starting in a non-run channel.
        cy.visit(`/${testTeam.name}/`);

        // * Check time bar in the channel section
        // * as an indicator of page stability / end of rendering
        cy.findByText('Today').should('be.visible');
    });

    describe('telemetry', () => {
        it('track page view', () => {
            // # intercepts telemetry
            cy.interceptTelemetry();

            // # Click the icon
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // * Assert telemetry data
            cy.wait('@telemetry');
            cy.expectTelemetryToBe([{name: 'channels_rhs_home', type: 'page'}]);
        });
    });

    describe('shows available', () => {
        it('starter templates', () => {
            // templates are defined in webapp/src/components/templates/template_data.tsx
            const templates = [
                {name: 'Blank', checklists: '1 checklist', actions: '1 action'},
                {name: 'Product Release', checklists: '4 checklists', actions: '3 actions'},
                {name: 'Incident Resolution', checklists: '4 checklists', actions: '4 actions'},
                {name: 'Customer Onboarding', checklists: '4 checklists', actions: '3 actions'},
                {name: 'Employee Onboarding', checklists: '5 checklists', actions: '2 actions'},
                {name: 'Feature Lifecycle', checklists: '5 checklists', actions: '3 actions'},
                {name: 'Bug Bash', checklists: '5 checklists', actions: '3 actions'},
                {name: 'Learn how to use playbooks', checklists: '2 checklists', actions: '2 actions'},
            ];

            // # Click the icon
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

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

    describe('show zero case if there are playbooks', () => {
        beforeEach(() => {
            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Team Playbook',
                memberIDs: [],
            });

            // # Click the icon
            cy.getPlaybooksAppBarIcon().should('be.visible').click();
        });

        it('without pre-populated channel name template', () => {
            // * Verify the templates are not shown
            cy.findAllByTestId('template-details').should('not.exist');

            // * Verify the zero case is shown
            cy.get('#sidebar-right').findByText('There are no runs in progress linked to this channel').should('be.visible');
        });
    });
});
