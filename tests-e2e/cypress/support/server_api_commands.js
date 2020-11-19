// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomInt, getRandomId} from '../utils';
import users from '../fixtures/users.json';
import timeouts from '../fixtures/timeouts';

// *****************************************************************************
// Authentication
// https://api.mattermost.com/#tag/authentication
// *****************************************************************************

/**
 * User login directly via API
 * @param {String} username - username
 * @param {String} password - password
 */
Cypress.Commands.add('apiLogin', (username = 'user-1', password = null) => {
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

/**
 * Logout a user directly via API
 */
Cypress.Commands.add('apiLogout', () => {
    cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/logout',
        method: 'POST',
        log: false,
        timeout: timeouts.HUGE,
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
Cypress.Commands.add('apiCreateTeam', (name, displayName, type = 'O') => {
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
        cy.wrap(response);
    });
});

/**
 * Gets the team matching the given name;
 */
Cypress.Commands.add('apiGetTeamByName', (name) => {
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
Cypress.Commands.add('apiAddUserToTeam', (teamId, userId) => {
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

// *****************************************************************************
// Users
// https://api.mattermost.com/#tag/users
// *****************************************************************************

/**
 * Get user by email directly via API
 * This API assume that the user is logged in and has permission to access
 * @param {String} email
 * All parameter required
 */
Cypress.Commands.add('apiGetUserByEmail', (email) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/email/' + email,
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

// *****************************************************************************
// Channels
// https://api.mattermost.com/#tag/channels
// *****************************************************************************

Cypress.Commands.add('apiCreateGroupChannel', (userList = [], teamName) => {
    cy.apiGetUsers(userList).then((res) => {
        const userIds = res.body.map((user) => user.id);
        cy.apiCreateGroup(userIds).then((resp) => {
            cy.apiGetTeams().then((response) => {
                const teamNameUrl = teamName || response.body[0].name;
                cy.visit(`/${teamNameUrl}/messages/${resp.body.name}`);
            });
        });
    });
});

Cypress.Commands.add('apiGetChannelByName', (teamName, channelName) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/teams/name/${teamName}/channels/name/${channelName}`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('apiAddUserToChannel', (channelId, userId) => {
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
Cypress.Commands.add('removeUserFromChannel', (channelId, userId) => {
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

Cypress.Commands.add('apiCreateChannel', (teamId, name, displayName, type = 'O', purpose = '', header = '', unique = true) => {
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

// *****************************************************************************
// Plugins
// https://api.mattermost.com/#tag/plugins
// *****************************************************************************

/**
 * Get webapp plugins directly via API
 * This API assume that the user is logged in and has permission to access
 */
Cypress.Commands.add('apiGetWebappPlugins', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/plugins/webapp',
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        cy.wrap(response);
    });
});

/**
 * Creates a group channel directly via API
 * This API assume that the user is logged in and has cookie to access
 * @param {String} userIds - IDs of users as member of the group
 * All parameters required except purpose and header
 */
Cypress.Commands.add('apiCreateGroup', (userIds = []) => {
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
 * Gets current user's teams
 */

Cypress.Commands.add('apiGetTeams', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: 'api/v4/users/me/teams',
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

/**
 * Gets users
 */
Cypress.Commands.add('apiGetUsers', (usernames = []) => {
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
Cypress.Commands.add('apiGetCurrentUser', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/me',
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body);
    });
});
