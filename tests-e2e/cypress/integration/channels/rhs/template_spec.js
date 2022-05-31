// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('channels > rhs > template', () => {
    let team1;
    let testUser;
   
    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            team1 = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('create playbook by RHS', () => {
      
        it('open new playbook creation modal and navigate to playbooks', () => {
           
            // # Switch to playbooks DM channel
            cy.visit(`/${team1.name}/messages/@playbooks`);
           
            // Open playbooks RHS.
            cy.get('button > .icon-product-playbooks').click();

            // Return first template (Blank) 
            cy.contains('Use').click();

            // Assert playbooks creation modal is shown.
            cy.get('#playbooks_create').should('exist');

            // Click create playbook button.
            cy.get('button[data-testid=modal-confirm-button]').click();

            // Navigate to playbooks creation url.
            cy.url().should('include', 'template=Blank') 
        });
    });
});
