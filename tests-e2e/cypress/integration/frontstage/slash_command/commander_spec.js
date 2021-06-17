// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('slash command > commander', () => {
    let testTeam;
    let teamId;
    let testUser;
    let userId;
    let testPlaybook;
    let playbookId;
    let testIncident;
    let incidentId;
    let incidentName;
    let incidentChannelName;

    before(() => {
        cy.apiInitSetup({createIncident: true}).then(({team, user, playbook, incident}) => {
            testTeam = team;
            teamId = team.id;
            testUser = user;
            userId = user.id;
            testPlaybook = playbook;
            playbookId = playbook.id;
            testIncident = incident;
            incidentId = incident.id;
            incidentName = incident.name;
            incidentChannelName = incidentName.toLowerCase();

            // # Switch to clean display mode
            cy.apiSaveMessageDisplayPreference('clean');
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin(testUser);

        // # Reset the commander to test user as necessary.
        cy.apiChangeIncidentCommander(incidentId, userId);
    });

    // describe('/incident commander', () => {
    it('should show an error when not in an incident channel', () => {
        // # Navigate to a non-incident channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Run a slash command to show the current commander
        cy.executeSlashCommand('/incident commander');

        // * Verify the expected error message.
        cy.verifyEphemeralMessage('You can only see the commander from within the incident\'s channel.');
    });

    it('should show the current commander', () => {
        // # Navigate directly to the application and the incident channel
        cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

        // # Run a slash command to show the current commander
        cy.executeSlashCommand('/incident commander');

        // * Verify the expected commander.
        cy.verifyEphemeralMessage(`@${testUser.username} is the current commander for this incident.`);
    });
    // });

    it('shows an error when not in an incident channel', () => {
        // # Navigate to a non-incident channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Run a slash command to change the current commander
        cy.executeSlashCommand('/incident commander user-2');

        // * Verify the expected error message.
        cy.verifyEphemeralMessage('You can only change the commander from within the incident\'s channel.');
    });

    it('should show an error when specifying more than one username', () => {
        // # Navigate directly to the application and the incident channel
        cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

        // # Run a slash command with too many parameters
        cy.executeSlashCommand(`/incident commander ${testUser.username} sysadmin`);

        // * Verify the expected error message.
        cy.verifyEphemeralMessage('/incident commander expects at most one argument.');
    });

    describe('should show an error when the user is not found', () => {
        beforeEach(() => {
            // # Navigate directly to the application and the incident channel
            cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);
        });

        it('when the username has no @-prefix', () => {
            // # Run a slash command to change the current commander
            cy.executeSlashCommand('/incident commander unknown');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Unable to find user @unknown');
        });

        it('when the username has an @-prefix', () => {
            // # Run a slash command to change the current commander
            cy.executeSlashCommand('/incident commander @unknown');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Unable to find user @unknown');
        });
    });

    describe('should show an error when the user is not in the channel', () => {
        beforeEach(() => {
            // # Navigate directly to the application and the incident channel
            cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

            // # Ensure the sysadmin is not part of the channel.
            cy.executeSlashCommand('/kick sysadmin');
        });

        it('when the username has no @-prefix', () => {
            // # Run a slash command to change the current commander
            cy.executeSlashCommand('/incident commander sysadmin');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('User @sysadmin must be part of this channel to make them commander.');
        });

        it('when the username has an @-prefix', () => {
            // # Run a slash command to change the current commander
            cy.executeSlashCommand('/incident commander @sysadmin');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('User @sysadmin must be part of this channel to make them commander.');
        });
    });

    describe('should show a message when the user is already the commander', () => {
        beforeEach(() => {
            // # Navigate directly to the application and the incident channel
            cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);
        });

        it('when the username has no @-prefix', () => {
            // # Run a slash command to change the current commander
            cy.executeSlashCommand(`/incident commander ${testUser.username}`);

            // * Verify the expected error message.
            cy.verifyEphemeralMessage(`User @${testUser.username} is already commander of this incident.`);
        });

        it('when the username has an @-prefix', () => {
            // # Run a slash command to change the current commander
            cy.executeSlashCommand(`/incident commander @${testUser.username}`);

            // * Verify the expected error message.
            cy.verifyEphemeralMessage(`User @${testUser.username} is already commander of this incident.`);
        });
    });

    describe('should change the current commander', () => {
        beforeEach(() => {
            // # Navigate directly to the application and the incident channel
            cy.visit(`/${testTeam.name}/channels/` + incidentChannelName);

            // # Ensure the sysadmin is part of the channel.
            cy.executeSlashCommand('/invite sysadmin');
        });

        it('when the username has no @-prefix', () => {
            // # Run a slash command to change the current commander
            cy.executeSlashCommand('/incident commander sysadmin');

            // * Verify the commander has changed.
            cy.verifyPostedMessage(`${testUser.username} changed the incident commander from @${testUser.username} to @sysadmin.`);
        });

        it('when the username has an @-prefix', () => {
            // # Run a slash command to change the current commander
            cy.executeSlashCommand('/incident commander @sysadmin');

            // * Verify the commander has changed.
            cy.verifyPostedMessage(`${testUser.username} changed the incident commander from @${testUser.username} to @sysadmin.`);
        });
    });
});
