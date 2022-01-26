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

            // # Set a bigger viewport so the action don't scroll out of view
            cy.viewport('macbook-16');
        });

        describe('adding and editing metrics', () => {
            it('can add 4, but not 5 metrics; can save and re-edit with metrics saved', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // # Add and verify metric
                addMetric('Duration', 'test duration', '0:0:1', 'test description');
                verifyViewMetric(0, 'test duration', '1 minute per run', 'test description');

                // # Add and verify metric
                addMetric('Dollars', 'test dollars', '2', 'test description 2');
                verifyViewMetric(1, 'test dollars', '2 per run', 'test description 2');

                // # Add and verify metric
                addMetric('Integer', 'test integer', '4', 'test descr 3');
                verifyViewMetric(2, 'test integer', '4 per run', 'test descr 3');

                // # Add and verify metric
                addMetric('Duration', 'test duration 2', '0:0:2', 'test description 4');
                verifyViewMetric(3, 'test duration 2', '2 minutes per run', 'test description 4');

                // * Verify Add Metric button is inactive
                cy.findByRole('button', {name: 'Add Metric'}).should('be.disabled');

                // * Verify we have four valid metrics and are editing none.
                verifyViewsAndEdits(4, 0);

                // # Save -- for the next batch of tests
                cy.findByTestId('save_playbook').click();

                // # Go back to editing
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // * Verify we saved the metrics
                verifyViewMetric(0, 'test duration', '1 minute per run', 'test description');
                verifyViewMetric(1, 'test dollars', '2 per run', 'test description 2');
                verifyViewMetric(2, 'test integer', '4 per run', 'test descr 3');
                verifyViewMetric(3, 'test duration 2', '2 minutes per run', 'test description 4');

                // # Edit all 4 metrics and repeat the test
                cy.findAllByTestId('edit-metric').eq(0).click();
                cy.get('input[type=text]').eq(2).clear().type('12:8:97');
                cy.findByRole('button', {name: 'Add'}).click();
                cy.findAllByTestId('edit-metric').eq(1).click();
                cy.get('textarea').eq(0).clear().type('a new description');
                cy.findByRole('button', {name: 'Add'}).click();
                cy.findAllByTestId('edit-metric').eq(2).click();
                cy.get('input[type=text]').eq(2).clear().type('7777777');
                cy.findByRole('button', {name: 'Add'}).click();
                cy.findAllByTestId('edit-metric').eq(3).click();
                cy.get('input[type=text]').eq(1).clear().type('test duration 2!!!');
                cy.findByRole('button', {name: 'Add'}).click();

                // # Save
                cy.findByTestId('save_playbook').click();

                // * Verify we're back in the main page
                cy.get('#playbooks-playbookPreview-checklists').should('exist');

                // # Go back to editing
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // * Verify we saved the metrics
                verifyViewMetric(0, 'test duration', '12 days 9 hours 37 minutes per run', 'test description');
                verifyViewMetric(1, 'test dollars', '2 per run', 'a new description');
                verifyViewMetric(2, 'test integer', '7777777 per run', 'test descr 3');
                verifyViewMetric(3, 'test duration 2!!!', '2 minutes per run', 'test description 4');

                // # Now test: verifies when clicking "Add", for duration type
                // # (using the previous state)

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
                cy.get('input[type=text]').eq(1).clear().wait(100).type('test duration again');
                cy.get('input[type=text]').eq(2).clear().type('a');
                cy.findByRole('button', {name: 'Add'}).click();
                cy.getStyledComponent('ErrorText')
                    .contains('Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00), or leave the target blank.');

                // * A duration target needs to be in the correct format (mm:dd:ss)
                cy.get('input[type=text]').eq(2).clear().type('0:123:0');
                cy.findByRole('button', {name: 'Add'}).click();
                cy.getStyledComponent('ErrorText')
                    .contains('Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00), or leave the target blank.');

                // # A duration can have 1 or 2 numbers in each position
                cy.get('input[type=text]').eq(2).clear().type('2:12:1');
                cy.findByRole('button', {name: 'Add'}).click();
                verifyViewMetric(0, 'test duration', '2 days 12 hours 1 minute per run', 'test description');

                // * Verify we have four valid metrics and are editing none.
                verifyViewsAndEdits(4, 0);

                // # Now test: on clicking edit, closes & saves current editing metric, and switches
                // # (using the previous state)

                // # Edit the second metric
                cy.findAllByTestId('edit-metric').eq(1).click();

                // * Verify editing correct metric, and only this metric
                cy.getStyledComponent('EditContainer').should('have.length', 1).within(() => {
                    cy.get('input[type=text]').eq(0).should('have.value', 'test dollars');
                });
                cy.getStyledComponent('ViewContainer').should('have.length', 3);

                // # Switch to editing third metric (second is in edit mode, so this is the third:)
                cy.findAllByTestId('edit-metric').eq(1).click();

                // * Verify editing correct metric, and only this metric
                cy.getStyledComponent('EditContainer').should('have.length', 1).within(() => {
                    cy.get('input[type=text]').eq(0).should('have.value', 'test integer');
                });
                cy.getStyledComponent('ViewContainer').should('have.length', 3);

                // # Edit third metric's title, switch to another metric
                cy.getStyledComponent('EditContainer').should('have.length', 1).within(() => {
                    cy.get('input[type=text]').eq(0).clear().type('test integer222');
                });
                cy.findAllByTestId('edit-metric').eq(0).click();

                // * Verify the title on the third metric (the second in view mode) was saved on switching
                verifyViewMetric(1, 'test integer222', '7777777 per run', 'test descr 3');

                // * Verify we have three valid metrics and are editing one.
                verifyViewsAndEdits(3, 1);
            });
        });

        describe('adding and editing metrics (new playbook)', () => {
            it('verifies when clicking "Add Metric", for Currency type, and switches to new edit', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // # Add and verify 1st metric
                addMetric('Integer', 'test integer!', '12314123', 'test description');
                verifyViewMetric(0, 'test integer!', '12314123 per run', 'test description');

                // # Add metric
                cy.findByRole('button', {name: 'Add Metric'}).click();
                cy.findByTestId('dropdownmenu').within(() => {
                    cy.findByText('Dollars').click();
                });

                // # Don't fill in the metric's details
                cy.get('input[type=text]').eq(1).clear();

                // * Metrics need a title
                cy.get('input[type=text]').eq(1).clear();
                cy.findByRole('button', {name: 'Add Metric'}).click();
                cy.findByTestId('dropdownmenu').within(() => {
                    cy.findByText('Integer').click();
                });
                cy.getStyledComponent('ErrorText').contains('Please add a title for your metric.');

                // * Metrics need a unique title
                cy.get('input[type=text]').eq(1).type('test integer!');
                cy.findByRole('button', {name: 'Add Metric'}).click();
                cy.findByTestId('dropdownmenu').within(() => {
                    cy.findByText('Integer').click();
                });
                cy.getStyledComponent('ErrorText')
                    .contains('A metric with the same name already exists. Please add a unique name for each metric.');

                // # Fill in title
                cy.get('input[type=text]').eq(1).clear().type('test currency!');

                // * A Currency target cannot be text
                cy.get('input[type=text]').eq(2).clear().type('z');
                cy.findByRole('button', {name: 'Add Metric'}).click();
                cy.findByTestId('dropdownmenu').within(() => {
                    cy.findByText('Integer').click();
                });
                cy.getStyledComponent('ErrorText').contains('Please enter a number, or leave the target blank.');

                // * A Currency target /can/ be blank, so can the description, and Add next Integer metric
                cy.get('input[type=text]').eq(2).clear();
                cy.findByRole('button', {name: 'Add Metric'}).click();
                cy.findByTestId('dropdownmenu').within(() => {
                    cy.findByText('Integer').click();
                });

                // * Verify metric was added without target or description.
                verifyViewMetric(1, 'test currency!', '', '');

                // * Verify we have two valid metrics and are editing next one.
                verifyViewsAndEdits(2, 1);

                // # Now test: verifies when clicking edit button, for Currency type, and switches to next edit
                // # (using the previous state)

                // # Don't fill in the metric's details
                cy.get('input[type=text]').eq(1).clear();

                // * Metrics need a title
                cy.get('input[type=text]').eq(1).clear();
                cy.findAllByTestId('edit-metric').eq(0).click();
                cy.getStyledComponent('ErrorText').contains('Please add a title for your metric.');

                // * Metrics need a unique title
                cy.get('input[type=text]').eq(1).type('test currency!');
                cy.findAllByTestId('edit-metric').eq(0).click();
                cy.getStyledComponent('ErrorText')
                    .contains('A metric with the same name already exists. Please add a unique name for each metric.');

                // # Fill in title
                cy.get('input[type=text]').eq(1).clear().type('test integer #2!!');

                // * An Integer target cannot be text
                cy.get('input[type=text]').eq(2).clear().type('arsoton');
                cy.findAllByTestId('edit-metric').eq(0).click();
                cy.getStyledComponent('ErrorText').contains('Please enter a number, or leave the target blank.');

                // * An Integer target /can/ be blank, so can the description, and edit first metric
                cy.get('input[type=text]').eq(2).clear();
                cy.findAllByTestId('edit-metric').eq(0).click();

                // * Verify we're editing the first metric, and only this metric
                cy.getStyledComponent('EditContainer').should('have.length', 1).within(() => {
                    cy.get('input[type=text]').eq(0).should('have.value', 'test integer!');
                });
                cy.getStyledComponent('ViewContainer').should('have.length', 2);

                // # Stop editing
                cy.findByRole('button', {name: 'Add'}).click();

                // * Verify metric was added without target or description.
                verifyViewMetric(2, 'test integer #2!!', '', '');

                // * Verify we have three valid metrics and are editing none.
                verifyViewsAndEdits(3, 0);
            });
        });

        describe('delete metric', () => {
            it('verifies when clicking delete button; saved metrics have different confirmation text; deleted metrics are deleted', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);

                // # Switch to Retrospective tab
                cy.get('#root').findByText('Retrospective').click();

                // # Add and verify 1st metric
                addMetric('Integer', 'test integer!', '12314123', 'test description');
                verifyViewMetric(0, 'test integer!', '12314123 per run', 'test description');

                // # Add metric
                cy.findByRole('button', {name: 'Add Metric'}).click();
                cy.findByTestId('dropdownmenu').within(() => {
                    cy.findByText('Dollars').click();
                });

                // # Don't fill in the metric's details
                cy.get('input[type=text]').eq(1).clear();

                // * Metrics need a title
                cy.get('input[type=text]').eq(1).clear();
                cy.findAllByTestId('delete-metric').eq(0).click();
                cy.getStyledComponent('ErrorText').contains('Please add a title for your metric.');

                // * Metrics need a unique title
                cy.get('input[type=text]').eq(1).type('test integer!');
                cy.findAllByTestId('delete-metric').eq(0).click();
                cy.getStyledComponent('ErrorText')
                    .contains('A metric with the same name already exists. Please add a unique name for each metric.');

                // # Fill in title
                cy.get('input[type=text]').eq(1).clear().type('test currency!');

                // * A Currency target cannot be text
                cy.get('input[type=text]').eq(2).clear().type('z');
                cy.findAllByTestId('delete-metric').eq(0).click();
                cy.getStyledComponent('ErrorText').contains('Please enter a number, or leave the target blank.');

                // # Remove error text and type another invalid entry
                cy.get('input[type=text]').eq(2).clear().type('invalid');

                // * Verify that we're allowed to delete a metric we are currently editing (even if it's invalid)
                cy.findAllByTestId('delete-metric').eq(1).click();
                cy.get('#confirm-modal-light').should('be.visible').contains('Are you sure you want to delete?');

                // # Dismiss
                cy.findByRole('button', {name: 'Cancel'}).click();

                // * A Currency target /can/ be blank, so can the description, try to delete first metric
                cy.get('input[type=text]').eq(2).clear();
                cy.findAllByTestId('delete-metric').eq(0).click();

                // # Should see the confirmation /without/ extra text because we haven't saved this metric yet
                cy.get('#confirm-modal-light')
                    .should('contain.text', 'If you delete this metric, the values for it will not be collected for any future runs.');
                cy.get('#confirm-modal-light')
                    .should('not.contain.text', 'You will still be able to access historical data for this metric.');

                // # Delete first metric
                cy.findByRole('button', {name: 'Delete metric'}).click();

                // * Verify metric
                verifyViewsAndEdits(1, 0);
                verifyViewMetric(0, 'test currency!', 'No target set.', 'No description.');

                // # Save and verify one is saved
                cy.findByTestId('save_playbook').click();
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);
                cy.get('#root').findByText('Retrospective').click();
                verifyViewsAndEdits(1, 0);
                verifyViewMetric(0, 'test currency!', 'No target set.', 'No description.');

                // # Delete metric
                cy.findAllByTestId('delete-metric').eq(0).click();

                // # Should see the confirmation /with/ extra text because we haven't saved this metric yet
                cy.get('#confirm-modal-light')
                    .should('contain.text', 'If you delete this metric, the values for it will not be collected for any future runs. You will still be able to access historical data for this metric.');

                // # Delete first metric
                cy.findByRole('button', {name: 'Delete metric'}).click();

                // * Verify
                verifyViewsAndEdits(0, 0);

                // # Save and verify deleted
                cy.findByTestId('save_playbook').click();
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/edit`);
                cy.get('#root').findByText('Retrospective').click();
                verifyViewsAndEdits(0, 0);
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

const verifyViewMetric = (index, title, target, description) => {
    cy.getStyledComponent('ViewContainer').eq(index).within(() => {
        cy.getStyledComponent('Title').contains(title);

        if (target) {
            cy.getStyledComponent('Detail').eq(0).contains(target);
        }

        if (description) {
            cy.getStyledComponent('Detail').eq(1).contains(description);
        }
    });
};

const verifyViewsAndEdits = (numViews, numEdits) => {
    cy.getStyledComponent('ViewContainer').should('have.length', numViews);
    cy.getStyledComponent('EditContainer').should('have.length', numEdits);
};
