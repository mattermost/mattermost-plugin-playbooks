// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

function waitUntilPermanentPost() {
    cy.get('#postListContent').should('exist');
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

Cypress.Commands.add('getLastPostId', () => {
    waitUntilPermanentPost();

    cy.findAllByTestId('postView').last().should('have.attr', 'id').and('not.include', ':')
        .invoke('replace', 'post_', '');
});

Cypress.Commands.add('getFirstPostId', () => {
    waitUntilPermanentPost();

    cy.findAllByTestId('postView').first().should('have.attr', 'id').and('not.include', ':')
        .invoke('replace', 'post_', '');
});

Cypress.Commands.add('getNthPostId', (n) => {
    waitUntilPermanentPost();

    cy.findAllByTestId('postView').eq(n).should('have.attr', 'id').and('not.include', ':')
        .invoke('replace', 'post_', '');
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
            cy.findByText('user-1 (you)').should('exist');
        });
    } else {
        cy.get('#channel-header').within(() => {
            cy.findByText(username).should('exist');
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
            cy.findByText(username, {exact: false}).should('exist');
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

// verifyPostedMessage verifies the receipt of a post containing the given message substring.
Cypress.Commands.add('verifyPostedMessage', (message) => {
    cy.wait(TIMEOUTS.TINY).getLastPostId().then((postId) => {
        cy.get(`#post_${postId}`).within(() => {
            cy.get(`#postMessageText_${postId}`).contains(message);
        });
    });
});

// verifyEphemeralMessage verifies the receipt of an ephemeral message containing the given
// message substring. An exact match is avoided to simplify tests.
Cypress.Commands.add('verifyEphemeralMessage', (message, isCompactMode, needsToScroll) => {
    if (needsToScroll) {
        // # Scroll the ephemeral message into view
        cy.get('#postListContent').within(() => {
            cy.get('.post-list__dynamic').scrollTo('bottom', {ensureScrollable: false});
        });
    }

    // # Checking if we got the ephemeral message with the selection we made
    cy.wait(TIMEOUTS.TINY).getLastPostId().then((postId) => {
        cy.get(`#post_${postId}`).within(() => {
            if (isCompactMode) {
                // * Check if Bot message only visible to you and has requisite message.
                cy.get(`#postMessageText_${postId}`).contains(message);
                cy.get(`#postMessageText_${postId}`).contains('(Only visible to you)');
            } else {
                // * Check if Bot message only visible to you
                cy.get('.post__visibility').last().should('exist').and('have.text', '(Only visible to you)');

                // * Check if we got ephemeral message of our selection
                cy.get(`#postMessageText_${postId}`).contains(message);
            }
        });
    });
});

/**
 * Update the status of the current playbook run through the slash command.
 */
Cypress.Commands.add('updateStatus', (message, reminder, status, description) => {
    // # Run the slash command to update status.
    cy.executeSlashCommand('/playbook update');

    // # Get the interactive dialog modal.
    cy.get('#interactiveDialogModal').within(() => {
        // # remove what's there (if this is a second update)
        cy.findByTestId('messageinput').clear();

        // # Type the new update in the text box.
        cy.findByTestId('messageinput').type(message);

        let actualStatus = status;
        if (!actualStatus) {
            actualStatus = 'reported';
        }

        actualStatus = actualStatus.toLowerCase();

        cy.findAllByTestId('autoCompleteSelector').eq(0).within(() => {
            cy.get('input').type(actualStatus, {delay: 200}).type('{enter}');
        });

        if (reminder) {
            cy.findAllByTestId('autoCompleteSelector').eq(1).within(() => {
                cy.get('input').type(reminder, {delay: 200}).type('{enter}');
            });
        }

        let actualDescription = description;
        if (!description) {
            actualDescription = 'description ' + Date.now();
        }

        // # remove and enter new description
        cy.findByTestId('descriptioninput').clear();
        cy.findByTestId('descriptioninput').type(actualDescription);

        // # Submit the dialog.
        cy.get('#interactiveDialogSubmit').click();
    });

    // * Verify that the interactive dialog has gone.
    cy.get('#interactiveDialogModal').should('not.exist');

    // # Return the post ID of the status update.
    return cy.getLastPostId();
});

/**
 * Delete a post through the post dot menu.
 * @param {String} postId - ID of the post to delete.
 */
Cypress.Commands.add('deletePost', (postId) => {
    // # Open the post dot menu.
    cy.clickPostDotMenu(postId);

    // # Click on the Delete menu option.
    cy.get(`#delete_post_${postId}`).click();

    // # Confirm the deletion in the dialog.
    cy.get('#deletePostModalButton').click();
});

/**
 * Edit a post through the post dot menu.
 * @param {String} postId - ID of the post to delete.
 * @param {String} newMessage - New content of the post.
 */
Cypress.Commands.add('editPost', (postId, newMessage) => {
    // # Open the post dot menu.
    cy.clickPostDotMenu(postId);

    // # Click on the Edit menu option.
    cy.get(`#edit_post_${postId}`).click();

    // # Overwrite the post content with the new message provided.
    cy.get('#edit_textbox').clear().type(newMessage);

    // # Confirm the edit in the dialog.
    cy.get('#editButton').click();
});

/**
 * Switch channel through the channel switcher
 * @param {String} channelName - Display name of the channel.
 */
Cypress.Commands.add('uiSwitchChannel', (channelName) => {
    if (Cypress.platform === 'darwin') {
        cy.get('body').type('{cmd}k');
    } else {
        cy.get('body').type('{ctrl}k');
    }
    cy.get('#quickSwitchInput').type(channelName);
    cy.get('#suggestionList > div:first-child').should('contain', channelName).click();
    cy.get('#channelHeaderTitle').contains(channelName);
});

Cypress.Commands.add('getStyledComponent', (className) => {
    cy.get(`[class^="${className}"]`);
});

/**
 * Get the provided pseudo-class from the previous element and return the property passed as argument
 * @param {String} pseudoClass - CSS pseudo class to get.
 * @param {String} property - Property that will be returned.
 *
 * Stolen from https://stackoverflow.com/questions/55516990/cypress-testing-pseudo-css-class-before
 */
Cypress.Commands.add('cssPseudoClass', {prevSubject: 'element'}, (el, pseudoClass, property) => {
    const win = el[0].ownerDocument.defaultView;
    const pseudoElem = win.getComputedStyle(el[0], pseudoClass);
    return pseudoElem.getPropertyValue(property).replace(/(^")|("$)/g, '');
});

/**
 * Get the :before pseudo-class from the previous element and return the property passed as argument
 * @param {String} property - Property that will be returned.
 */
Cypress.Commands.add('before', {prevSubject: 'element'}, (el, property) => {
    return cy.wrap(el).cssPseudoClass('before', property);
});

/**
 * Get the :after pseudo-class from the previous element and return the property passed as argument
 * @param {String} property - Property that will be returned.
 */
Cypress.Commands.add('after', {prevSubject: 'element'}, (el, property) => {
    return cy.wrap(el).cssPseudoClass('after', property);
});
