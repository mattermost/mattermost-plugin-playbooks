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
            })

            // # Navigate to the application
            cy.visit(`/${testTeam.name}/`);

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the playbook is shown
            cy.findByText('Team Playbook').should('exist')
        });
        
        it('starter templates', () => {
            // # templates are defined in `webapp/src/components/backstage/template_selector.tsx`
            const templateNames = [
                'Blank', 
                'Product Release', 
                'Customer Onboarding', 
                'Service Reliability Incident'
            ];

            // # Navigate to the application
            cy.visit(`/${testTeam.name}/`);

            // # Click the icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist').click({force: true});
            });

            // * Verify the templates are shown
            templateNames.forEach((name) => {
                cy.findByText(name).should('exist');
            });
        });
    });
});