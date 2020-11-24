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
Cypress.Commands.add('verifyEphemeralMessage', (message, isCompactMode) => {
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
 * Update the status of the current incident through the slash command.
 * @param {String} message - The new status.
 * @param {Boolean} isOngoing - Default to true. If false, the update will also end the incident.
 */
Cypress.Commands.add('updateStatus', (message) => {
    // # Run the /incident status slash command.
    cy.executeSlashCommand('/incident update');

    // # Get the interactive dialog modal.
    cy.get('#interactiveDialogModal').within(() => {
        // # Type the new update in the text box.
        cy.findByTestId('message').type(message);

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
    cy.get('body').type('{ctrl}k');
    cy.get('#quickSwitchInput').type(channelName);
    cy.get('#suggestionList > div:first-child').should('contain', channelName).click();
    cy.get('#channelHeaderTitle').contains(channelName);
});
