// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

describe('playbooks > edit_metrics', () => {
    let testTeam;
    let testUser;

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
    });

    describe('actions', () => {
        let testPlaybook;

        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);
        });

        beforeEach(() => {
            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook (' + Date.now() + ')',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        describe('add metrics', () => {
            it('can add 4, but not 5 metrics', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // # Add and verify metric
                addMetric('Duration', 'test duration', '0:0:1', 'test description');
                verifyMetric(0, 'Duration', 'test duration', '00:00:01', 'test description');

                // # Add and verify metric
                addMetric('Dollars', 'test dollars', '2', 'test description 2');
                verifyMetric(1, 'Dollars', 'test dollars', '2', 'test description 2');

                // # Add and verify metric
                addMetric('Integer', 'test integer', '4', 'test descr 3');
                verifyMetric(2, 'Integer', 'test integer', '4', 'test descr 3');

                // # Add and verify metric
                addMetric('Duration', 'test duration 2', '0:0:2', 'test description 4');
                verifyMetric(3, 'Duration', 'test duration 2', '00:00:02', 'test description 4');

                // * Verify Add Metric button is inactive
                cy.findByRole('button', {name: 'Add Metric'}).should('be.disabled');
            });

            it('needs a title, a non-duplicate title, and a valid target for each type', () => {
                // # Edit the first metric
                cy.findAllByTestId('edit-metric').eq(0).click();

                // * Metrics need a title
                cy.get('input[type=text]').eq(1).clear();
                cy.findByRole('button', {name: 'Add'}).click();
                cy.getStyledComponent('ErrorText').contains('Please add a title for your metric.');

                // * Metrics need a unique title
                cy.get('input[type=text]').eq(1).type('test dollars');
                cy.findByRole('button', {name: 'Add'}).click();
                cy.getStyledComponent('ErrorText')
                    .contains('A metric with the same name already exists. Please add a unique name for each metric.');

                // * A duration target needs to be in the correct format (no letters)
                cy.get('input[type=text]').eq(1).clear().type('test duration again');
                cy.get('input[type=text]').eq(2).clear().type('a');
                cy.findByRole('button', {name: 'Add'}).click();
                cy.getStyledComponent('ErrorText')
                    .contains('Please enter a duration in the format: dd:mm:ss (e.g., 12:00:00), or leave the target blank.');

                // * A duration target needs to be in the correct format (mm:dd:ss)
                cy.get('input[type=text]').eq(2).clear().type('0:123:0');
                cy.findByRole('button', {name: 'Add'}).click();
                cy.getStyledComponent('ErrorText')
                    .contains('Please enter a duration in the format: dd:mm:ss (e.g., 12:00:00), or leave the target blank.');

                // # A duration can have 1 or 2 numbers in each position
                cy.get('input[type=text]').eq(2).clear().type('2:12:1');
                cy.findByRole('button', {name: 'Add'}).click();
                verifyMetric(0, 'Duration', 'test duration', '02:12:01', 'test description');
            });
        });
    });
});

const addMetric = (type, title, target, description) => {
    const fullType = type === 'Duration' ? 'Duration (in dd:hh:mm)' : type;

    // # Add the requested metric
    cy.findByRole('button', {name: 'Add Metric'}).click();
    cy.findByTestId('dropdownmenu').within(() => {
        cy.findByText(fullType).click();
    });

    // # Fill in the metric's details
    cy.get('input[type=text]').eq(1).type(title)
        .tab().type(target)
        .tab().type(description);

    // # Add the metric
    cy.findByRole('button', {name: 'Add'}).click();
};

const verifyMetric = (index, type, title, target, description) => {
    cy.getStyledComponent('MetricContainer').eq(index).within(() => {
        cy.getStyledComponent('Title').contains(title);
        cy.getStyledComponent('Detail').eq(0).contains(target + ' per run');
        cy.getStyledComponent('Detail').eq(1).contains(description);
    });
};
