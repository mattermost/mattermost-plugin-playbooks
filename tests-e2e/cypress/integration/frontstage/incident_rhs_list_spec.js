// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

describe('rhs incident list', () => {
    const playbookName = 'Playbook (' + Date.now() + ')';
    const playbook2Name = 'Playbook (' + (Date.now() + 1) + ')';
    let teamId;
    let userId;
    let user2Id;
    let playbookId;
    let playbook2Id;

    before(() => {
        // # Login as user-1
        cy.apiLogin('user-1');

        cy.apiGetTeamByName('ad-1').then((team) => {
            teamId = team.id;
            cy.apiGetCurrentUser().then((user) => {
                userId = user.id;

                // # Create a playbook
                cy.apiCreateTestPlaybook({
                    teamId: team.id,
                    title: playbookName,
                    userId: user.id,
                }).then((playbook) => {
                    playbookId = playbook.id;
                });
            });
        });

        // # Login as user-2
        cy.apiLogin('user-2');

        cy.apiGetCurrentUser().then((user) => {
            user2Id = user.id;

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId,
                title: playbook2Name,
                userId: user2Id,
            }).then((playbook) => {
                playbook2Id = playbook.id;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as user-1
        cy.apiLogin('user-1');
    });

    describe('should show welcome screen', () => {
        it('when user has no active incidents', () => {
            // # delete all incidents
            cy.endAllActiveIncidents(teamId);

            // # Login as user-1
            cy.apiLogin('user-1');

            cy.apiGetCurrentUser().then((user) => {
                expect(user.id).to.equal(userId);
            });

            // # Navigate directly to a non-incident channel
            cy.wait(1000).visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // * Verify we see the welcome screen when there are no incidents
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('welcome-view-has-playbooks').should('be.visible');
            });
        });

        it('when in an incident, leaving to another channel, and ending the incident', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/off-topic');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start an incident
            const incidentName = 'Private ' + Date.now();
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId
            }).then((incident) => {
                const incidentId = incident.id;
                cy.verifyIncidentCreated(teamId, incidentName);

                // # move to non-incident channel
                cy.get('#sidebarItem_town-square').click();
                cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

                // # Click the incident icon
                cy.get('#channel-header').within(() => {
                    cy.get('#incidentIcon').should('be.visible').click();
                });

                // * Verify the rhs list is open the incident is visible.
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('be.visible');
                });

                cy.apiEndIncident(incidentId);
            });

            // * Verify we see the welcome screen when there are no incidents
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('welcome-view-has-playbooks').should('be.visible');
            });
        });
    });

    describe('should see the complete incident list', () => {
        it('after creating two incidents and moving back to town-square', () => {
            cy.endAllMyActiveIncidents(teamId);

            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // # start 2 incidents
            const now = Date.now();
            let incidentName = 'Private ' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            incidentName = 'Private ' + Date.now();
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // * Verify the rhs list is still open and two go-to-channel buttons are visible.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findAllByTestId('go-to-channel').should('have.length', 2);
            });
        });

        it('after seeing incident details and clicking on the back button', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });

                // * Verify the title shows "Ongoing"
                cy.get('.sidebar--right__title').contains('Ongoing');
            });

            // # bring up the incident list
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('back-button').should('be.visible').click();
            });

            // * Verify the rhs list is open incident is visible.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findByText(incidentName).should('be.visible');
            });
        });

        it('in incidents, closing the RHS, going to town-square, and clicking on the header icon', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Close the RHS
            cy.get('#rhsContainer').within(() => {
                cy.get('#searchResultsCloseButton').should('be.visible').click();
            });

            // # Go to town-square
            cy.get('#sidebarItem_town-square').click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the rhs list is closed
            cy.get('#rhsContainer').should('not.be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // * Verify the rhs list is open and we can see the new incident
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findByText(incidentName).should('be.visible');
            });
        });

        it('after clicking back and going to town-square', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the back button
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('back-button').should('be.visible').click();
            });

            // # Go to town-square
            cy.get('#sidebarItem_town-square').click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the rhs list is open and we can see the new incident
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findByText(incidentName).should('be.visible');
            });
        });

        it('after going to a private channel and clicking on the header icon', () => {
            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Visit a private channel: autem-2
            cy.visit('/ad-1/channels/autem-2');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the rhs list is closed
            cy.get('#rhsContainer').should('not.be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // * Verify the rhs list is open and we can see the new incident
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findByText(incidentName).should('be.visible');
            });
        });
    });

    describe('should see incident details', () => {
        it('after opening incidents list and clicking on the go to channel button', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // * click on the first go-to-channel button.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findAllByTestId('go-to-channel').eq(0).click();
            });

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });

                // * Verify the title shows "Ongoing"
                cy.get('.sidebar--right__title').contains('Ongoing');
            });
        });

        it('after going to an incident channel, closing rhs, and clicking on LHS of another incident channel', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start 2 new incidents
            let now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            now = Date.now() + 1;
            const secondIncidentName = 'Incident (' + now + ')';
            const secondIncidentChannelName = 'incident-' + now;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName: secondIncidentName,
                commanderUserId: userId
            });
            cy.verifyIncidentCreated(teamId, secondIncidentName);

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${secondIncidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(secondIncidentName).should('be.visible');
                });

                // * Verify the title shows "Ongoing"
                cy.get('.sidebar--right__title').contains('Ongoing');
            });

            // # Close the RHS
            cy.get('#rhsContainer').within(() => {
                cy.get('#searchResultsCloseButton').should('be.visible').click();
            });

            // # Open the first incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });

                // * Verify the title shows "Ongoing"
                cy.get('.sidebar--right__title').contains('Ongoing');
            });
        });

        it('after going to incident, closing rhs, going to town-square, and clicking on same incident channel in LHS', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });
            });

            // # Close the RHS
            cy.get('#rhsContainer').within(() => {
                cy.get('#searchResultsCloseButton').should('be.visible').click();
            });

            // # Open town-square from the LHS.
            cy.get('#sidebarItem_town-square').click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the rhs list is closed
            cy.get('#rhsContainer').should('not.be.visible');

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });

                // * Verify the title shows "Ongoing"
                cy.get('.sidebar--right__title').contains('Ongoing');
            });
        });

        it('after going to incident, go to town-square, then back', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });
            });

            // # Open town-square from the LHS.
            cy.get('#sidebarItem_town-square').click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the rhs list is open and we can see the new incident
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findByText(incidentName).should('be.visible');
            });

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });

                // * Verify the title shows "Ongoing"
                cy.get('.sidebar--right__title').contains('Ongoing');
            });
        });
    });

    describe('websockets', () => {
        it('should see incident in list when user is added to the channel by another user', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // # Login as user-2
            cy.apiLogin('user-2');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbook2Id, incidentName, commanderUserId: user2Id});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # add user-1 to the incident
            let channelId;
            cy.apiGetChannelByName('ad-1', incidentChannelName).then(({channel}) => {
                channelId = channel.id;
                cy.apiAddUserToChannel(channelId, userId);
            });

            // * Verify the rhs list is open and we can see the new incident
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findByText(incidentName).should('be.visible');
            });
        });

        it('should see incident in list when user creates new incident and presses back button', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });

                // * Verify the title shows "Ongoing"
                cy.get('.sidebar--right__title').contains('Ongoing');

                // # Click the back button
                cy.findByTestId('back-button').should('be.visible').click();
            });

            // * Verify the rhs list is open and we can see the new incident
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findByText(incidentName).should('be.visible');
            });
        });

        it('incident should be removed from list when user is removed from channel', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // # Login as user-2
            cy.apiLogin('user-2');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbook2Id, incidentName, commanderUserId: user2Id});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # add user-1 to the incident
            cy.apiGetChannelByName('ad-1', incidentChannelName).then(({channel}) => {
                const channelId = channel.id;
                cy.apiAddUserToChannel(channelId, userId);

                // * Verify the rhs list is open and we can see the new incident
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('be.visible');
                });

                // # remove user-1 from the incident
                cy.removeUserFromChannel(channelId, userId);

                // * Verify the incident is not listed
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('not.be.visible');
                });
            });
        });

        it('incident should be removed from list when the user closes incident and presses back button', () => {
            // # Select a channel without an incident.
            cy.get('#sidebarItem_town-square').click();
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });

                // * Verify the title shows "Ongoing"
                cy.get('.sidebar--right__title').contains('Ongoing');
            });

            // # End incident and go to incident list
            cy.get('#rhsContainer').should('be.visible').within(() => {
                // # End the incident
                cy.findByText('End Incident').click();
            });

            // # Confirm ending the incident
            cy.get('.modal-dialog').should('be.visible').find('#interactiveDialogSubmit').click();

            cy.get('#rhsContainer').should('be.visible').within(() => {
                // * Verify the title shows "Ended"
                cy.get('.sidebar--right__title').contains('Ended');

                // # Click the back button
                cy.findByTestId('back-button').should('be.visible').click();
            });

            cy.get('#rhsContainer').should('be.visible').within(() => {
                // * Verify the rhs list is open
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                // * Verify we cannot see the ended incident
                cy.findByText(incidentName).should('not.be.visible');
            });
        });

        it('incident should be removed from list when another user closes incident', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // # Login as user-2
            cy.apiLogin('user-2');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            let incidentId;
            cy.apiStartIncident({
                teamId,
                playbook2Id,
                incidentName,
                commanderUserId: user2Id
            }).then((incident) => {
                incidentId = incident.id;
            });
            cy.verifyIncidentCreated(teamId, incidentName);

            // # add user-1 to the incident
            cy.apiGetChannelByName('ad-1', incidentChannelName).then(({channel}) => {
                cy.apiAddUserToChannel(channel.id, userId);

                // * Verify the rhs list is open and we can see the new incident
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('be.visible');
                });

                // # User-2 closes the incident
                cy.apiEndIncident(incidentId);

                // * Verify the incident is not listed
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('not.be.visible');
                });
            });
        });

        it('should see incident in list when the user restarts an incident and presses back button', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            let incidentId;
            cy.apiStartIncident({
                teamId,
                playbookId,
                incidentName,
                commanderUserId: userId
            }).then((incident) => {
                incidentId = incident.id;
                cy.verifyIncidentCreated(teamId, incidentName);

                // * Verify the rhs list is open and we can see the new incident
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('be.visible');
                });

                // # User-1 closes the incident
                cy.apiEndIncident(incidentId);

                // * Verify we cannot see the incident
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('not.be.visible');
                });

                // # User-1 restarts the incident
                cy.apiRestartIncident(incidentId);

                // * Verify the rhs list is open and we can see the new incident
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('be.visible');
                });
            });
        });

        it('should see incident in list when another user restarts an incident', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // * Verify we can see the incidents list
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');
            });

            // # Login as user-2
            cy.apiLogin('user-2');

            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({
                teamId,
                playbook2Id,
                incidentName,
                commanderUserId: user2Id
            }).then((incident) => {
                const incidentId = incident.id;
                cy.verifyIncidentCreated(teamId, incidentName);

                // # add user-1 to the incident
                cy.apiGetChannelByName('ad-1', incidentChannelName).then(({channel}) => {
                    cy.apiAddUserToChannel(channel.id, userId);
                });

                // * Verify the rhs list is open and we can see the new incident
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('be.visible');
                });

                // # User-2 closes the incident
                cy.apiEndIncident(incidentId);

                // * Verify we cannot see the incident
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('not.be.visible');
                });

                // # User-2 restarts the incident
                cy.apiRestartIncident(incidentId);

                // * Verify the rhs list is open and we can see the new incident
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    cy.findByText('Your Ongoing Incidents').should('be.visible');

                    cy.findByText(incidentName).should('be.visible');
                });
            });
        });
    });

    describe('menu items', () => {
        it('should be able to open start incident dialog', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // In case we're running this test from scratch, the incident list should not be empty.
            // # start new incident
            const now = Date.now();
            const incidentName = 'Incident (' + now + ')';
            const incidentChannelName = 'incident-' + now;
            cy.apiStartIncident({teamId, playbookId, incidentName, commanderUserId: userId});
            cy.verifyIncidentCreated(teamId, incidentName);

            // # Open the incident channel from the LHS.
            cy.get(`#sidebarItem_${incidentChannelName}`).click();

            // * Verify the incident RHS is open.
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByTestId('rhs-title').should('be.visible').within(() => {
                    cy.findByText(incidentName).should('be.visible');
                });
            });

            // # Open town-square from the LHS.
            cy.get('#sidebarItem_town-square').click();

            // * Verify the rhs list is open and we can see the new incident
            cy.get('#rhsContainer').should('be.visible').within(() => {
                cy.findByText('Your Ongoing Incidents').should('be.visible');

                cy.findByText(incidentName).should('be.visible');
            });

            // # click the Start Incident link
            cy.get('#rhsContainer').within(() => {
                cy.findByText('Start Incident').click();
            });

            // * Verify the incident creation dialog has opened
            cy.get('#interactiveDialogModal').should('be.visible').within(() => {
                cy.findByText('Incident Details').should('be.visible');
            });
        });

        it('should be able to create playbook from three dot menu', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // # click the Start Incident link
            cy.get('#rhsContainer').find('.icon-dots-vertical').click();

            // # click the Create Playbook link
            cy.get('#rhsContainer').within(() => {
                cy.findByText('Create Playbook').click();
            });

            // * Verify we reached the playbook backstage
            cy.url().should('include', '/ad-1/com.mattermost.plugin-incident-response/playbooks');
        });

        it('should be able to go to incident backstage from three dot menu', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // # click the Start Incident link
            cy.get('#rhsContainer').find('.icon-dots-vertical').click();

            // # click the Create Playbook link
            cy.get('#rhsContainer').within(() => {
                cy.findByText('See all Incidents').click();
            });

            // * Verify we reached the playbook backstage
            cy.url().should('include', '/ad-1/com.mattermost.plugin-incident-response/incidents');
        });

        it('should be able to see all incidents (incidents backstage list)', () => {
            // # Navigate directly to a non-incident channel
            cy.visit('/ad-1/channels/town-square');
            cy.get('#centerChannelFooter').findByTestId('post_textbox').should('be.visible');

            // # Click the incident icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('be.visible').click();
            });

            // # click the Start Incident link
            cy.get('#rhsContainer').within(() => {
                cy.get('a').within(() => {
                    cy.findByText('Click here').click();
                });
            });

            // * Verify we reached the playbook backstage
            cy.url().should('include', '/ad-1/com.mattermost.plugin-incident-response/incidents');
        });
    });
});
