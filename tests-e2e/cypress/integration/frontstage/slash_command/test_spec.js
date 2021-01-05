// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('slash command > test', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    let teamId;
    let playbookId;

    before(() => {
        // # Login as user-1.
        cy.apiLogin('user-1');

        // # Switch to clean display mode.
        cy.apiSaveMessageDisplayPreference('clean');

        // # Create a playbook.
        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                cy.apiGetUserByEmail('sysadmin@sample.mattermost.com').then((admin) => {
                    cy.apiCreatePlaybook({
                        teamId: team.id,
                        title: playbookName,
                        checklists: [
                            {
                                title: 'Stage 1',
                                items: [
                                    {title: 'Step 1'},
                                    {title: 'Step 2'},
                                ],
                            },
                            {
                                title: 'Stage 2',
                                items: [
                                    {title: 'Step 1'},
                                    {title: 'Step 2'},
                                ],
                            },
                        ],
                        memberIDs: [user.id, admin.id],
                    }).then((playbook) => {
                        playbookId = playbook.id;
                    });
                });
            });
        });
    });

    describe('as a regular user', () => {
        before(() => {
            // # Login as sysadmin.
            cy.apiLogin('sysadmin');

            // # Set EnableTesting to true.
            cy.apiUpdateConfig({
                ServiceSettings: {
                    EnableTesting: true
                },
            });
        });

        beforeEach(() => {
            // # Login as user-1
            cy.apiLogin('user-1');

            // # Navigate to a channel.
            cy.visit('/ad-1/channels/town-square');
        });

        it('fails to run subcommand bulk-data', () => {
            // # Execute the bulk-data command.
            cy.executeSlashCommand('/incident test bulk-data');

            // * Verify the ephemeral message warns that the user is not admin.
            cy.verifyEphemeralMessage('Running the test command is restricted to system administrators.');
        });

        it('fails to run subcommand create-incident', () => {
            // # Execute the create-incident command.
            cy.executeSlashCommand('/incident test create-incident');

            // * Verify the ephemeral message warns that the user is not admin.
            cy.verifyEphemeralMessage('Running the test command is restricted to system administrators.');
        });

        it('fails to run subcommand self', () => {
            // # Execute the self command.
            cy.executeSlashCommand('/incident test self');

            // * Verify the ephemeral message warns that the user is not admin.
            cy.verifyEphemeralMessage('Running the test command is restricted to system administrators.');
        });
    });

    describe('as an admin', () => {
        describe('with EnableTesting set to false', () => {
            before(() => {
                // # Login as sysadmin.
                cy.apiLogin('sysadmin');

                // # Set EnableTesting to false.
                cy.apiUpdateConfig({
                    ServiceSettings: {
                        EnableTesting: false
                    },
                });
            });

            beforeEach(() => {
                // # Login as sysadmin.
                cy.apiLogin('sysadmin');

                // # Navigate to a channel.
                cy.visit('/ad-1/channels/town-square');
            });

            it('fails to run subcommand bulk-data', () => {
                // # Execute the bulk-data command.
                cy.executeSlashCommand('/incident test bulk-data');

                // * Verify the ephemeral message warns that the user is not admin.
                cy.verifyEphemeralMessage('Setting EnableTesting must be set to true to run the test command.');
            });

            it('fails to run subcommand create-incident', () => {
                // # Execute the create-incident command.
                cy.executeSlashCommand('/incident test create-incident');

                // * Verify the ephemeral message warns that the user is not admin.
                cy.verifyEphemeralMessage('Setting EnableTesting must be set to true to run the test command.');
            });

            it('fails to run subcommand self', () => {
                // # Execute the self command.
                cy.executeSlashCommand('/incident test self');

                // * Verify the ephemeral message warns that the user is not admin.
                cy.verifyEphemeralMessage('Setting EnableTesting must be set to true to run the test command.');
            });
        });

        describe('with EnableTesting set to true', () => {
            before(() => {
                // # Login as sysadmin.
                cy.apiLogin('sysadmin');

                // # Set EnableTesting to true.
                cy.apiUpdateConfig({
                    ServiceSettings: {
                        EnableTesting: true
                    },
                });
            });

            beforeEach(() => {
                // # Login as sysadmin.
                cy.apiLogin('sysadmin');

                // # Size the viewport to show the RHS without covering posts.
                cy.viewport('macbook-13');

                // # Navigate to a channel.
                cy.visit('/ad-1/channels/town-square');
            });

            describe('with subcommand self', () => {
                it('asks for confirmation', () => {
                    // # Execute the self command.
                    cy.executeSlashCommand('/incident test self');

                    // * Verify the ephemeral message asks for the confirmation keywords.
                    cy.verifyEphemeralMessage('Are you sure you want to self-test (which will nuke the database and delete all data -- instances, configuration)? All incident data will be lost. To self-test, type /incident test self CONFIRM TEST SELF');
                });
            });

            describe('with subcommand create', () => {
                it('fails to run with no arguments', () => {
                    // # Execute the create-incident command with no arguments.
                    cy.executeSlashCommand('/incident test create-incident');

                    // * Verify the ephemeral message warns about the parameters.
                    cy.verifyEphemeralMessage('The command expects three parameters: <playbook_id> <timestamp> <incident name>');
                });

                it('fails to run with one argument', () => {
                    // # Execute the create-incident command with one argument.
                    cy.executeSlashCommand('/incident test create-incident ' + playbookId);

                    // * Verify the ephemeral message warns about the parameters.
                    cy.verifyEphemeralMessage('The command expects three parameters: <playbook_id> <timestamp> <incident name>');
                });

                it('fails to run with two arguments', () => {
                    // # Execute the create-incident command with two arguments.
                    cy.executeSlashCommand('/incident test create-incident ' + playbookId + '2020-01-01');

                    // * Verify the ephemeral message warns about the parameters.
                    cy.verifyEphemeralMessage('The command expects three parameters: <playbook_id> <timestamp> <incident name>');
                });

                it('fails to run with a malformed playbook ID', () => {
                    // # Execute the create-incident command with all arguments, but a malformed plabook ID.
                    cy.executeSlashCommand('/incident test create-incident unknownID 2020-01-01 The incident name');

                    // * Verify the ephemeral message warns about the ID.
                    cy.verifyEphemeralMessage('The first parameter, <playbook_id>, must be a valid ID.');
                });

                it('fails to run with a valid, but unknown playbook ID', () => {
                    // # Execute the create-incident command with all arguments, but an unknown plabook ID.
                    cy.executeSlashCommand('/incident test create-incident abcdefghijklmnopqrstuvwxyz 2020-01-01 The incident name');

                    // * Verify the ephemeral message warns about the parameter.
                    cy.verifyEphemeralMessage('The playbook with ID \'abcdefghijklmnopqrstuvwxyz\' does not exist.');
                });

                it('fails to run with a malformed date', () => {
                    // # Execute the create-incident command with all arguments, but a malformed creation timestamp.
                    cy.executeSlashCommand('/incident test create-incident ' + playbookId + ' 2020-1-1 The incident name');

                    // * Verify the ephemeral message warns about the parameter.
                    cy.verifyEphemeralMessage('Timestamp \'2020-1-1\' could not be parsed as a date. If you want the incident to start on January 2, 2006, the timestamp should be \'2006-01-02\'.');
                });

                it('creates an incident with the correct date in the past', () => {
                    const now = Date.now();
                    const incidentName = 'Incident (' + now + ')';

                    // # Execute the create-incident command with correct arguments.
                    cy.executeSlashCommand('/incident test create-incident ' + playbookId + ' 2020-01-01 ' + incidentName);

                    // * Verify the ephemeral message informs that the incident was created.
                    cy.verifyEphemeralMessage('Incident successfully created: ~' + incidentName);

                    // # Click on the link to the created incident.
                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#post_${lastPostId}`).within(() => {
                            cy.get('a').click();
                        });
                    });

                    // # Retrieve the incident via API.
                    cy.apiGetIncidentByName(teamId, incidentName).then((response) => {
                        const returnedIncidents = JSON.parse(response.body);
                        const incident = returnedIncidents.items.find((inc) => inc.name === incidentName);

                        // * Verify that the incident is active.
                        assert.isDefined(incident);
                        assert.isTrue(incident.is_active);

                        // * Verify that the creation timestamp is correct.
                        assert.equal('2020-01-01', moment(incident.create_at).format('YYYY-MM-DD'));
                    });
                });
            });

            describe('with subcommand bulk-data', () => {
                it('fails to run with no arguments', () => {
                    // # Execute the bulk-data command with no arguments.
                    cy.executeSlashCommand('/incident test bulk-data');

                    // * Verify that the ephemeral message contains a help message about the arguments.
                    cy.verifyEphemeralMessage('/incident test bulk-data expects at least 4 arguments: [ongoing] [ended] [begin] [end]. Optionally, a fifth argument can be added: [seed].');
                });

                it('fails to run with one argument', () => {
                    // # Execute the bulk-data command with one argument.
                    cy.executeSlashCommand('/incident test bulk-data 10');

                    // * Verify that the ephemeral message contains a help message about the arguments.
                    cy.verifyEphemeralMessage('/incident test bulk-data expects at least 4 arguments: [ongoing] [ended] [begin] [end]. Optionally, a fifth argument can be added: [seed].');
                });

                it('fails to run with two arguments', () => {
                    // # Execute the bulk-data command with two arguments.
                    cy.executeSlashCommand('/incident test bulk-data 10 5');

                    // * Verify that the ephemeral message contains a help message about the arguments.
                    cy.verifyEphemeralMessage('/incident test bulk-data expects at least 4 arguments: [ongoing] [ended] [begin] [end]. Optionally, a fifth argument can be added: [seed].');
                });

                it('fails to run with three arguments', () => {
                    // # Execute the bulk-data command with three arguments.
                    cy.executeSlashCommand('/incident test bulk-data 10 5 2020-01-01');

                    // * Verify that the ephemeral message contains a help message about the arguments.
                    cy.verifyEphemeralMessage('/incident test bulk-data expects at least 4 arguments: [ongoing] [ended] [begin] [end]. Optionally, a fifth argument can be added: [seed].');
                });

                it('fails to run with malformed number of ongoing incidents', () => {
                    // # Execute the bulk-data command with all arguments, but a malformed number of ongoing incidents.
                    cy.executeSlashCommand('/incident test bulk-data aa 5 2020-01-01 2020-10-10');

                    // * Verify that the ephemeral message informs of the specific parsing error.
                    cy.verifyEphemeralMessage('The provided value for ongoing incidents, \'aa\', is not an integer.');
                });

                it('fails to run with malformed number of ended incidents', () => {
                    // # Execute the bulk-data command with all arguments, but a malformed number of ended incidents.
                    cy.executeSlashCommand('/incident test bulk-data 10 10.5 2020-01-01 2020-10-10');

                    // * Verify that the ephemeral message informs of the specific parsing error.
                    cy.verifyEphemeralMessage('The provided value for ended incidents, \'10.5\', is not an integer.');
                });

                it('fails to run with malformed begin date', () => {
                    // # Execute the bulk-data command with all arguments, but a malformed begin date.
                    cy.executeSlashCommand('/incident test bulk-data 10 5 2020-1-1 2020-10-10');

                    // * Verify that the ephemeral message informs of the specific parsing error.
                    cy.verifyEphemeralMessage('The provided value for the first possible date, \'2020-1-1\', is not a valid date. It needs to be in the format 2020-01-31.');
                });

                it('fails to run with malformed end date', () => {
                    // # Execute the bulk-data command with all arguments, but a malformed end date.
                    cy.executeSlashCommand('/incident test bulk-data 10 5 2020-01-01 2020');

                    // * Verify that the ephemeral message informs of the specific parsing error.
                    cy.verifyEphemeralMessage('The provided value for the last possible date, \'2020\', is not a valid date. It needs to be in the format 2020-01-31.');
                });

                it('fails to run with end date before begin date', () => {
                    // # Execute the bulk-data command with begin date after end date.
                    cy.executeSlashCommand('/incident test bulk-data 10 5 2020-01-01 2019-01-01');

                    // * Verify that the ephemeral message informs of the specific logic error.
                    cy.verifyEphemeralMessage('end must be a later date than begin');
                });

                it('fails to run with end date equal to begin date', () => {
                    // # Execute the bulk-data command with begin date equal to end date.
                    cy.executeSlashCommand('/incident test bulk-data 10 5 2020-01-01 2020-01-01');

                    // * Verify that the ephemeral message informs of the specific logic error.
                    cy.verifyEphemeralMessage('end must be a later date than begin');
                });

                it('creates no incidents when both ongoing and ended parameters are zero', () => {
                    // # Execute the bulk-data command for creating zero incidents.
                    cy.executeSlashCommand('/incident test bulk-data 0 0 2020-01-01 2020-10-01');

                    // * Verify that the ephemeral message informs that no incidents were created.
                    cy.verifyEphemeralMessage('Zero incidents created.');
                });

                it('creates only ongoing incidents', () => {
                    // # Execute the bulk-data command with only ongoing incidents.
                    cy.executeSlashCommand('/incident test bulk-data 2 0 2020-01-01 2020-10-01 42');

                    // * Verify that the ephemeral message informs that the generation was successful.
                    cy.verifyEphemeralMessage('The test data was successfully generated:');

                    // * Verify the number of created incidents is correct.
                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#post_${lastPostId}`).within(() => {
                            cy.get('a').should('have.length', 2);
                        });
                    });
                });

                it('creates only ended incidents', () => {
                    // # Execute the bulk-data command with only ended incidents.
                    cy.executeSlashCommand('/incident test bulk-data 0 2 2020-01-01 2020-10-01 42');

                    // * Verify that the ephemeral message informs that the generation was successful.
                    cy.verifyEphemeralMessage('The test data was successfully generated:');

                    // * Verify the number of created incidents is correct.
                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#post_${lastPostId}`).within(() => {
                            cy.get('a').should('have.length', 2);
                        });
                    });
                });

                it('creates ongoing and ended incidents', () => {
                    // # Execute the bulk-data command with both ongoing and ended incidents.
                    cy.executeSlashCommand('/incident test bulk-data 2 2 2020-01-01 2020-10-01 42');

                    // * Verify that the ephemeral message informs that the generation was successful
                    cy.verifyEphemeralMessage('The test data was successfully generated:');

                    // * Verify the number of created incidents is correct.
                    cy.getLastPostId().then((lastPostId) => {
                        cy.get(`#post_${lastPostId}`).within(() => {
                            cy.get('a').should('have.length', 4);
                        });
                    });
                });
            });
        });
    });
});
