// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

function waitUntilPermanentPost() {
    cy.get('#postListContent').should('be.visible');
    cy.waitUntil(() => cy.findAllByTestId('postView').last().then((el) => !(el[0].id.includes(':'))));
}

function clickPostHeaderItem(postId, location, item) {
    if (postId) {
        cy.get(`#post_${postId}`).trigger('mouseover', {force: true});
        cy.wait(TIMEOUTS.TINY).get(`#${location}_${item}_${postId}`).click({force: true});
    } else {
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#post_${lastPostId}`).trigger('mouseover', {force: true});
            cy.wait(TIMEOUTS.TINY).get(`#${location}_${item}_${lastPostId}`).click({force: true});
        });
    }
}

// getTestElement, just the function here, but it's a Cypress command in our codebase
export function getTestElement(selector) {
    return cy.get(`[data-testid="${selector}"]`);
}

Cypress.Commands.add('getLastPostId', () => {
    waitUntilPermanentPost();

    cy.findAllByTestId('postView').last().should('have.attr', 'id').and('not.include', ':').
        invoke('replace', 'post_', '');
});

/**
 * Click dot menu by post ID or to most recent post (if post ID is not provided)
 * @param {String} postId - Post ID
 * @param {String} location - as 'CENTER', 'RHS_ROOT', 'RHS_COMMENT', 'SEARCH'
 */
Cypress.Commands.add('clickPostDotMenu', (postId, location = 'CENTER') => {
    clickPostHeaderItem(postId, location, 'button');
});

// Start a direct message with user <username>
Cypress.Commands.add('startDirectMessage', (username, self = false, user = '') => {
    cy.get('#addDirectChannel').click();
    cy.get('#selectItems').type(username);
    cy.get('.clickable').contains(username).click({force: true});
    if (!self) {
        cy.get('#saveItems').click();
    }

    if (self === true && user === 'user-1') {
        cy.get('#channelHeaderInfo').within(() => {
            cy.findByText('user-1 (you)').should('be.visible');
        });
    } else {
        cy.get('#channel-header').within(() => {
            cy.findByText(username).should('be.visible');
        });
    }
});

// Start a group message with the given users.
Cypress.Commands.add('startGroupMessage', (usernames) => {
    cy.get('#addDirectChannel').click();
    usernames.forEach((username) => {
        cy.get('#selectItems').type(username);
        cy.get('.clickable').contains(username).click({force: true});
    });
    cy.get('#saveItems').click();

    usernames.forEach((username) => {
        cy.get('#channel-header').within(() => {
            cy.findByText(username, {exact: false}).should('be.visible');
        });
    });
});

// getCurrentTeamId fetches the current team id, assuming the main chat is being displayed.
//
// It doesn't work when the sidebar with this attribute isn't being rendered. We should probably
// fetch this another, but for now just copying the webapp example.
Cypress.Commands.add('getCurrentTeamId', () => {
    return cy.get('#headerTeamName').invoke('attr', 'data-teamid');
});

Cypress.Commands.add('getCurrentUserId', () => {
    return cy.getCookie('MMUSERID').then((cookie) => cookie.value);
});
