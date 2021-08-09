// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// From: https://github.com/cypress-io/cypress/issues/877#issuecomment-490504922
Cypress.Commands.add('isInViewport', (element) => {
    cy.get(element).then((el) => {
        const bottom = Cypress.$(cy.state('window')).height();
        const rect = el[0].getBoundingClientRect();

        expect(rect.top).not.to.be.greaterThan(bottom);
        expect(rect.bottom).not.to.be.greaterThan(bottom);
        expect(rect.top).not.to.be.greaterThan(bottom);
        expect(rect.bottom).not.to.be.greaterThan(bottom);
    });
});
