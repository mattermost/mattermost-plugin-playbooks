// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import merge from 'deepmerge';

import {getRandomInt, getRandomId} from '../utils';
import users from '../fixtures/users.json';

// *****************************************************************************
// Authentication
// https://api.mattermost.com/#tag/authentication
// *****************************************************************************

/**
 * User login directly via API
 * @param {String} username - username
 * @param {String} password - password
 */
Cypress.Commands.add('legacyApiLogin', (username = 'user-1', password = null) => {
    cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/login',
        method: 'POST',
        body: {login_id: users[username].username, password: password || users[username].password},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

// *****************************************************************************
// Teams
// https://api.mattermost.com/#tag/teams
// *****************************************************************************

/**
 * Creates a team directly via API
 * This API assume that the user is logged in and has permission to access
 * @param {String} name - Unique handler for a team, will be present in the team URL
 * @param {String} displayName - Non-unique UI name for the team
 * @param {String} type - 'O' for open (default), 'I' for invite only
 * All parameters required
 */
Cypress.Commands.add('legacyApiCreateTeam', (name, displayName, type = 'O') => {
    const uniqueName = `${name}-${getRandomInt(9999).toString()}`;

    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/teams',
        method: 'POST',
        body: {
            name: uniqueName,
            display_name: displayName,
            type,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        cy.wrap({team: response.body});
    });
});

/**
 * Gets the team matching the given name;
 */
Cypress.Commands.add('legacyApiGetTeamByName', (name) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/teams/name/' + name,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body);
    });
});

/**
 * Add user into a team directly via API
 * This API assume that the user is logged in and has permission to access
 * @param {String} teamId - The team ID
 * @param {String} userId - ID of user to be added into a team
 * All parameter required
 */
Cypress.Commands.add('legacyApiAddUserToTeam', (teamId, userId) => {
    cy.request({
        method: 'POST',
        url: `/api/v4/teams/${teamId}/members`,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        body: {team_id: teamId, user_id: userId},
        qs: {team_id: teamId},
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap(response);
    });
});

/**
 * Remove a User from a Team directly via API
 * @param {String} teamID - The team ID
 * @param {String} userId - The user ID
 * All parameter required
 */
Cypress.Commands.add('legacyApiRemoveUserFromTeam', (teamId, userId) => {
    cy.request({
        method: 'DELETE',
        url: `/api/v4/teams/${teamId}/members/${userId}`,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

Cypress.Commands.add('legacyApiGetChannelByName', (teamName, channelName) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/teams/name/${teamName}/channels/name/${channelName}`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('legacyApiAddUserToChannel', (channelId, userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/' + channelId + '/members',
        method: 'POST',
        body: {
            user_id: userId,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({member: response.body});
    });
});

/**
 * Remove a User from a Channel directly via API
 * @param {String} channelId - The channel ID
 * @param {String} userId - The user ID
 * All parameter required
 */
Cypress.Commands.add('legacyRemoveUserFromChannel', (channelId, userId) => {
    //Remove a User from a Channel
    cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/channels/${channelId}/members/${userId}`,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({member: response.body});
    });
});

Cypress.Commands.add('legacyApiCreateChannel', (teamId, name, displayName, type = 'O', purpose = '', header = '', unique = true) => {
    const randomSuffix = getRandomId();

    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels',
        method: 'POST',
        body: {
            team_id: teamId,
            name: unique ? `${name}-${randomSuffix}` : name,
            display_name: unique ? `${displayName} ${randomSuffix}` : displayName,
            type,
            purpose,
            header,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('legacyApiPatchChannel', (channelId, channelData) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/channels/${channelId}/patch`,
        body: channelData,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('legacyApiDeleteChannel', (channelId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'DELETE',
        url: `/api/v4/channels/${channelId}`,
    }).then((response) => {
        expect(response.status).to.equal(200);
    });
});

// *****************************************************************************
// Plugins
// https://api.mattermost.com/#tag/plugins
// *****************************************************************************

/**
 * Creates a group channel directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} userIds - IDs of users as member of the group
 * All parameters required except purpose and header
 */
Cypress.Commands.add('legacyApiCreateGroup', (userIds = []) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/group',
        method: 'POST',
        body: userIds,
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap(response);
    });
});

/**
 * Creates a direct channel directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} userAID - ID of the first user in the DM
 * @param {String} userBID - ID of the second user in the DM
 * All parameters required except purpose and header
 */
Cypress.Commands.add('legacyApiCreateDM', (userAID, userBID) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/direct',
        method: 'POST',
        body: [userAID, userBID],
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({channel: response.body});
    });
});

/**
 * Gets users
 */
Cypress.Commands.add('legacyApiGetUsers', (usernames = []) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/usernames',
        method: 'POST',
        body: usernames,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

/**
 * Gets the current user.
 */
Cypress.Commands.add('legacyApiGetCurrentUser', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/me',
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body);
    });
});

Cypress.Commands.add('legacyApiUpdateConfig', (newConfig = {}) => {
    // # Get current settings
    return cy.request('/api/v4/config').then((response) => {
        const oldConfig = response.body;

        const config = merge.all([oldConfig, newConfig]);

        // # Set the modified config
        return cy.request({
            url: '/api/v4/config',
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            method: 'PUT',
            body: config,
        }).then((updateResponse) => {
            expect(updateResponse.status).to.equal(200);
            return cy.apiGetConfig();
        });
    });
});

/**
* Creates a post directly via API
* This API assume that the user is logged in and has cookie to access
* @param {String} channelId - Where to post
* @param {String} message - What to post
* @param {String} rootId - Parent post ID. Set to "" to avoid nesting
* @param {Object} props - Post props
* @param {String} token - Optional token to use for auth. If not provided - posts as current user
*/
Cypress.Commands.add('legacyApiCreatePost', (channelId, message, rootId, props, token = '', failOnStatusCode = true) => {
    const headers = {'X-Requested-With': 'XMLHttpRequest'};
    if (token !== '') {
        headers.Authorization = `Bearer ${token}`;
    }
    cy.request({
        headers,
        failOnStatusCode,
        url: '/api/v4/posts',
        method: 'POST',
        body: {
            channel_id: channelId,
            root_id: rootId,
            message,
            props,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({post: response.body});
    });
});

/**
* Deletes a post directly via API
* This API assume that the user is logged in and has cookie to access
* @param {String} postId - ID of the post to delete
*/
Cypress.Commands.add('legacyApiDeletePost', (postId) => {
    const headers = {'X-Requested-With': 'XMLHttpRequest'};
    return cy.request({
        url: `/api/v4/posts/${postId}`,
        headers,
        method: 'DELETE',
    });
});

/**
* Edits a post directly via API
* This API assume that the user is logged in and has cookie to access
* @param {String} postId - ID of the post to edit
* @param {String} message - What to post
*/
Cypress.Commands.add('legacyApiEditPost', (postId, message) => {
    const headers = {'X-Requested-With': 'XMLHttpRequest'};
    return cy.request({
        url: `/api/v4/posts/${postId}`,
        headers,
        method: 'PUT',
        body: {
            id: postId,
            message,
        }
    });
});
