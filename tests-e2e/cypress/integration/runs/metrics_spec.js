// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('runs > edit_metrics', () => {
    let testTeam;
    let testUser;
    let testPlaybookWithMetrics;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Create playbook with metrics
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Playbook with metrics',
            memberIDs: [],
            createPublicPlaybookRun: true,
            metrics: [
                {
                    title: 'title1',
                    description: 'description1',
                    type: 'metric_duration',
                    target: 720000,
                },
                {
                    title: 'title2',
                    description: 'description2',
                    type: 'metric_currency',
                    target: 40,
                },
                {
                    title: 'title3',
                    description: 'description3',
                    type: 'metric_integer',
                    target: 30,
                },
            ]
        }).then((playbook) => {
            testPlaybookWithMetrics = playbook;
        });
    });

    describe('runs with metrics', () => {
        let runId;

        beforeEach(() => {
            // # Create a new playbook run
            const now = Date.now();
            const runName = 'Playbook Run (' + now + ')';
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybookWithMetrics.id,
                playbookRunName: runName,
                ownerUserId: testUser.id,
            }).then((run) => {
                runId = run.id;
            });
        });

        describe('retrospective tab ui', () => {
            it('metrics inputs info(title, target, description) and order', () => {
                // # Navigate directly to the retro tab
                cy.visit(`/playbooks/runs/${runId}/retrospective`);

                // * Verify metrics number
                cy.getStyledComponent('InputContainer').should('have.length', 3);

                // * Verify metrics infos
                verifyMetricInput(0, 'title1', '12 minutes', 'description1');
                verifyMetricInput(1, 'title2', '40', 'description2');
                verifyMetricInput(2, 'title3', '30', 'description3');
            });

            it('metrics inputs, null and zero values', () => {
                // # Set targets to null and update playbook
                testPlaybookWithMetrics.metrics[0].target = null;
                testPlaybookWithMetrics.metrics[1].target = 0;
                cy.apiUpdatePlaybook(testPlaybookWithMetrics).then(() => {
                    // # Navigate directly to the retro tab
                    cy.visit(`/playbooks/runs/${runId}/retrospective`);

                    // * Verify if Target text(top | left) is removed
                    verifyMetricInput(0, 'title1', null, 'description1');
                    verifyMetricInput(1, 'title2', '0', 'description2');
                    verifyMetricInput(2, 'title3', '30', 'description3');
                });
            });

            it('run without metrics', () => {
                // # Edit playbook, remove all metrics. then check retro tab ui
                testPlaybookWithMetrics.metrics = null;
                cy.apiUpdatePlaybook(testPlaybookWithMetrics).then(() => {
                    // # Navigate directly to the retro tab
                    cy.visit(`/playbooks/runs/${runId}/retrospective`);

                    // * Verify there are no metrics inputs
                    cy.getStyledComponent('InputContainer').should('not.exist');
                });
            });
        });

        describe('entering metric values', () => {
            it('auto save', () => {
                // # Navigate directly to the retro tab
                cy.visit(`/playbooks/runs/${runId}/retrospective`);

                // # Enter metric values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).type('12:11:10')
                    .tab().type('56')
                    .tab().type('123');

                // # Navigate to the overview tab and then back. Click should flush changes
                cy.findByText('Overview').click({force: true});
                cy.findByText('Retrospective').click({force: true});

                // * Validate if values persist
                cy.get('input[type=text]').eq(0).should('have.value', '12:11:10');
                cy.get('input[type=text]').eq(1).should('have.value', '56');
                cy.get('input[type=text]').eq(2).should('have.value', '123');

                // # Enter new values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).clear().type('12:00:10')
                    .tab().clear().type('20')
                    .tab().clear().type('21');

                // # Wait 2 sec to auto save
                cy.wait(2000);

                // # Reload page and navigate to the retro tab
                cy.visit(`/playbooks/runs/${runId}/retrospective`);

                // * Validate if values are saved
                cy.get('input[type=text]').eq(0).should('have.value', '12:00:10');
                cy.get('input[type=text]').eq(1).should('have.value', '20');
                cy.get('input[type=text]').eq(2).should('have.value', '21');
            });

            it('save empty and zero values', () => {
                // # Navigate directly to the retro tab
                cy.visit(`/playbooks/runs/${runId}/retrospective`);

                // # Enter metric values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).clear().type('00:00:00')
                    .tab().type('7')
                    .tab().type('0');

                // # Navigate to the overview tab and then back
                cy.findByText('Overview').click({force: true});
                cy.findByText('Retrospective').click({force: true});

                // * Validate if values persist
                cy.get('input[type=text]').eq(0).should('have.value', '00:00:00');
                cy.get('input[type=text]').eq(1).should('have.value', '7');
                cy.get('input[type=text]').eq(2).should('have.value', '0');

                // # Clear first two metrics values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).clear()
                    .tab().clear();

                // # Navigate to the overview tab and then back
                cy.findByText('Overview').click({force: true});
                cy.findByText('Retrospective').click({force: true});

                // * Validate if values persist
                cy.get('input[type=text]').eq(0).should('have.value', '');
                cy.get('input[type=text]').eq(1).should('have.value', '');
                cy.get('input[type=text]').eq(2).should('have.value', '0');
            });

            it('only valid values are saved. check error messages', () => {
                // # Navigate directly to the retro tab
                cy.visit(`/playbooks/runs/${runId}/retrospective`);

                // # Enter invalid metric values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).type('5')
                    .tab().type('56d')
                    .tab().type('125');

                // * Validate error messages
                cy.getStyledComponent('ErrorText').eq(0).contains('Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00).');
                cy.getStyledComponent('ErrorText').eq(1).contains('Please enter a number.');

                // # Navigate to the overview tab and then back
                cy.findByText('Overview').click({force: true});
                cy.findByText('Retrospective').click({force: true});

                // # Reload page and navigate to the retro tab
                cy.visit(`/playbooks/runs/${runId}/retrospective`);

                // * Validate that values are not saved
                cy.get('input[type=text]').eq(0).should('have.value', '');
                cy.get('input[type=text]').eq(1).should('have.value', '');
                cy.get('input[type=text]').eq(2).should('have.value', '125');

                // # Enter new metric values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).type('s')
                    .tab().type('d')
                    .tab().type('k');
            });

            it('publish retro', () => {
                // # Navigate directly to the retro tab
                cy.visit(`/playbooks/runs/${runId}/retrospective`);

                //# Enter metric invalid values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).type('20:00:12d')
                    .tab().type('56')
                    .tab().type('125v');

                // # Publish
                cy.findByRole('button', {name: 'Publish'}).click();

                // * Verify we're not showing the publish retro confirmation modal
                cy.get('#confirm-modal-light').should('not.exist');

                //# Enter empty metric values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).clear()
                    .tab().clear()
                    .tab().clear().type(24);

                // # Publish
                cy.findByRole('button', {name: 'Publish'}).click();

                // * Validate error messages
                cy.getStyledComponent('ErrorText').eq(0).contains('Please fill in the metric value.');
                cy.getStyledComponent('ErrorText').eq(1).contains('Please fill in the metric value.');
                cy.getStyledComponent('ErrorText').should('have.length', 2);

                // * Verify we're not showing the publish retro confirmation modal
                cy.get('#confirm-modal-light').should('not.exist');

                //# Enter valid metric values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).type('09:87:12')
                    .tab().type(123);

                // # Publish
                cy.findByRole('button', {name: 'Publish'}).click();

                // * Verify we're showing the publish retro confirmation modal
                cy.get('#confirm-modal-light').contains('Are you sure you want to publish?');

                // # Publish
                cy.findByRole('button', {name: 'Publish'}).click();

                // * Verify that retro got published
                cy.get('.icon-check-all').should('be.visible');

                // * Verify that metrics inputs are disabled
                cy.get('input[type=text]').each(($el) => {
                    cy.wrap($el).should('not.be.enabled');
                });
            });
        });
    });
});

const verifyMetricInput = (index, title, target, description) => {
    cy.getStyledComponent('InputContainer').eq(index).within(() => {
        cy.getStyledComponent('Title').contains(title);

        if (target) {
            cy.getStyledComponent('TargetTitle').contains(target);
        } else {
            cy.getStyledComponent('TargetTitle').should('not.exist');
        }

        if (description) {
            cy.getStyledComponent('HelpText').contains(description);
        }
    });
};
