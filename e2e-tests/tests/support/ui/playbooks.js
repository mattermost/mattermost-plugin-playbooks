// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';
const playbookRunStartCommand = '/playbook run';

Cypress.Commands.add('startPlaybookRun', (playbookName, playbookRunName) => {
    cy.get('#appsModal').should('exist').within(() => {
        // # Select playbook
        cy.selectPlaybookFromDropdown(playbookName);

        // # Type playbook run name
        cy.findByTestId('playbookRunNameinput').type(playbookRunName, {force: true});

        // # Submit
        cy.get('#appsModalSubmit').click();
    });

    cy.get('#appsModal').should('not.exist');
});

// Opens playbook run dialog using the `/playbook run` slash command
Cypress.Commands.add('openPlaybookRunDialogFromSlashCommand', () => {
    cy.uiPostMessageQuickly(playbookRunStartCommand);
});

// Starts playbook run with the `/playbook run` slash command
Cypress.Commands.add('startPlaybookRunWithSlashCommand', (playbookName, playbookRunName) => {
    cy.openPlaybookRunDialogFromSlashCommand();

    cy.startPlaybookRun(playbookName, playbookRunName);
});

// Selects Playbooks icon in the App Bar
Cypress.Commands.add('getPlaybooksAppBarIcon', () => {
    cy.get('#channel_view').should('be.visible');

    return cy.get('.app-bar').find('#app-bar-icon-playbooks');
});

// Starts playbook run from the playbook run RHS
Cypress.Commands.add('startPlaybookRunFromRHS', (playbookName, playbookRunName) => {
    cy.get('#channel-header').within(() => {
        // open flagged posts to ensure playbook run RHS is closed
        cy.get('#channelHeaderFlagButton').click();

        // open the playbook run RHS
        cy.getPlaybooksAppBarIcon().should('exist').click();
    });

    cy.get('#rhsContainer').should('exist').within(() => {
        cy.findByText('Run playbook').click();
    });

    cy.startPlaybookRun(playbookName, playbookRunName);
});

// Create a new task from the RHS
Cypress.Commands.add('addNewTaskFromRHS', (taskname) => {
    // Click add new task
    cy.findByTestId('add-new-task-0').click();

    // Type a name
    cy.findByTestId('checklist-item-textarea-title').type(taskname);

    // Save task
    cy.findByTestId('checklist-item-save-button').click();
});

// Starts playbook run from the post menu
Cypress.Commands.add('startPlaybookRunFromPostMenu', (playbookName, playbookRunName) => {
    // post a message as user to avoid system message
    cy.findByTestId('post_textbox').clear().type('new message here{enter}');

    // post a second message because cypress has trouble finding latest post when there's only one message
    cy.findByTestId('post_textbox').clear().type('another new message here{enter}');
    cy.clickPostActionsMenu();
    cy.findByRole('menuitem', {name: 'Run playbook'}).click();
    cy.startPlaybookRun(playbookName, playbookRunName);
});

// Create playbook
Cypress.Commands.add('createPlaybook', (teamName, playbookName) => {
    cy.visit('/playbooks/playbooks/new');

    cy.findByTestId('save_playbook', {timeout: TIMEOUTS.HALF_MIN}).should('exist');

    // # Type playbook name
    cy.get('#playbook-name .editable-trigger').click();
    cy.get('#playbook-name .editable-input').type(playbookName);
    cy.get('#playbook-name .editable-input').type('{enter}');

    // # Save playbook — wait for button to re-enable after name autosave, then save
    cy.findByTestId('save_playbook', {timeout: TIMEOUTS.HALF_MIN}).should('not.be.disabled').click();
    cy.findByTestId('save_playbook', {timeout: TIMEOUTS.HALF_MIN}).should('not.be.disabled').click();
});

// Select the playbook from the dropdown menu
Cypress.Commands.add('selectPlaybookFromDropdown', (playbookName) => {
    cy.findByTestId('playbookID').should('exist').within(() => {
        cy.get('input').click().type(playbookName.toLowerCase(), {force: true});
    });
    cy.document().its('body').find('[id$=-listbox]').contains(playbookName).click({force: true});
});

Cypress.Commands.add('createPost', (message) => {
    // post a message as user to avoid system message
    cy.findByTestId('post_textbox').clear().type(`${message}{enter}`);
});

Cypress.Commands.add('addPostToTimelineUsingPostMenu', (playbookRunName, summary, postId) => {
    cy.clickPostDotMenu(postId);
    cy.findByTestId('playbookRunAddToTimeline').click();

    cy.get('#appsModal').should('exist').within(() => {
        // # Select playbook run
        cy.findByTestId('playbookID').should('exist').within(() => {
            cy.get('input').click().type(playbookRunName);
        });
        cy.document().its('body').find('[id$=-listbox]').contains(playbookRunName).click({force: true});

        // # Type playbook run name
        cy.findByTestId('summaryinput').clear().type(summary, {force: true});

        // # Submit
        cy.get('#appsModalSubmit').click();
    });

    cy.get('#appsModal').should('not.exist');
});

Cypress.Commands.add('openSelector', () => {
    cy.findByText('Search for people').click({force: true});
});

Cypress.Commands.add('addInvitedUser', (userName) => {
    cy.get('.invite-users-selector__menu').within(() => {
        cy.findByText(userName).click({force: true});
    });
});

Cypress.Commands.add('selectOwner', (userName) => {
    cy.get('.assign-owner-selector__menu').within(() => {
        cy.findByText(userName).click({force: true});
    });
});

Cypress.Commands.add('openReminderSelector', () => {
    cy.get('#reminder_timer_datetime input').click({force: true});
});

Cypress.Commands.add('selectReminderTime', (timeText) => {
    cy.get('#reminder_timer_datetime .playbooks-rselect__menu').within(() => {
        cy.findByText(timeText).click({force: true});
    });
});

/**
 * Update the status of the current playbook run through the slash command.
 */
Cypress.Commands.add('updateStatus', (message, reminderQuery) => {
    // # Run the slash command to update status.
    cy.uiPostMessageQuickly('/playbook update');

    // # Get the interactive dialog modal.
    cy.getStatusUpdateDialog().within(() => {
        // # remove what's there if applicable, and type the new update in the textbox.
        cy.findByTestId('update_run_status_textbox').should('be.visible').clear().type(message);

        if (reminderQuery) {
            cy.get('#reminder_timer_datetime input').click({force: true}).realType(reminderQuery);

            // Wait for the debounced option parsing (150ms debounce) to complete
            // eslint-disable-next-line cypress/no-unnecessary-waiting
            cy.wait(500);
            cy.get('#reminder_timer_datetime input').realType('{enter}');
        }

        // # Submit the dialog.
        cy.get('button.confirm').click();
    });

    // * Verify that the interactive dialog has gone.
    cy.getStatusUpdateDialog().should('not.exist');

    // # Return the post ID of the status update.
    return cy.getLastPostId();
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

Cypress.Commands.add('getStatusUpdateDialog', () => {
    return cy.findByRole('dialog', {name: /post update/i});
});

Cypress.Commands.add('getStyledComponent', (className) => {
    cy.get(`[class^="${className}-"]`);
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

function waitUntilPermanentPost() {
    cy.get('#postListContent').should('exist');
    cy.waitUntil(() => cy.findAllByTestId('postView').last().then((el) => !(el[0].id.includes(':'))));
}

Cypress.Commands.add('getFirstPostId', () => {
    waitUntilPermanentPost();

    cy.findAllByTestId('postView').first().should('have.attr', 'id').and('not.include', ':').
        invoke('replace', 'post_', '');
});

/**
 * Find a run row in the runs list (#playbookRunList) by run name.
 * Returns the row element as a Cypress subject so callers can chain .within() or assertions.
 * @param {String} runName - The run name to locate in the list
 */
Cypress.Commands.add('playbooksGetRunListRow', (runName) => {
    return cy.get('#playbookRunList').findByText(runName).parents('[data-testid="run-list-item"]');
});

/**
 * Navigate to the channel associated with a playbook run.
 * @param {String} teamName - The team name (slug) for the URL
 * @param {Object} run - The run object (must have channel_id)
 */
Cypress.Commands.add('playbooksVisitRunChannel', (teamName, run) => {
    cy.apiGetChannel(run.channel_id).then(({channel}) => {
        cy.visit(`/${teamName}/channels/${channel.name}`);
    });
});

/**
 * Navigate directly to a playbook run details page by run ID.
 * @param {String} runId - The run ID
 */
Cypress.Commands.add('playbooksVisitRun', (runId) => {
    cy.visit(`/playbooks/runs/${runId}`);
    cy.findByTestId('run-header-section').should('exist');
});

/**
 * Register an intercept alias for a named GraphQL mutation on the Playbooks query endpoint.
 * Does NOT mock the response — only tags the request so cy.wait('@operationName') can block
 * until the server responds. This is the standard sync mechanism for debounced mutations.
 *
 * Usage:
 *   cy.playbooksInterceptGraphQLMutation('UpdatePlaybook');
 *   // ... trigger UI action ...
 *   cy.wait('@UpdatePlaybook');
 *
 * @param {String} operationName - The GraphQL operation name (used as the cy.wait alias)
 */
Cypress.Commands.add('playbooksInterceptGraphQLMutation', (operationName) => {
    cy.intercept('POST', '/plugins/playbooks/api/v0/query', (req) => {
        if (req.body && req.body.operationName === operationName) {
            req.alias = operationName;
        }
    });
});

/**
 * Register an intercept alias for the REST PUT /playbooks/:id endpoint.
 * Use when waiting for the debounced playbook save triggered by editor changes.
 *
 * Usage:
 *   cy.playbooksInterceptUpdatePlaybook();
 *   // ... trigger UI action ...
 *   cy.wait('@UpdatePlaybook');
 */
Cypress.Commands.add('playbooksInterceptUpdatePlaybook', () => {
    cy.intercept('PUT', '/plugins/playbooks/api/v0/playbooks/*').as('UpdatePlaybook');
});

/**
 * Change the run owner via the RHS profile selector.
 * Must be called while already on the run's channel page (after playbooksVisitRunChannel).
 * @param {String} newOwnerUsername - Username of the new owner to select
 */
Cypress.Commands.add('playbooksChangeRunOwnerViaRHS', (newOwnerUsername) => {
    cy.intercept('POST', '/plugins/playbooks/api/v0/runs/*/owner').as('SetRunOwnerRHS');
    cy.findByTestId('owner-profile-selector').click();

    // Profiles are loaded asynchronously via useProfilesInTeam. The dropdown
    // options refresh once the API response arrives and Redux updates, so we
    // wait up to HALF_MIN for the option to become available.
    cy.contains('.playbook-react-select__option', newOwnerUsername, {timeout: TIMEOUTS.HALF_MIN}).click();
    cy.wait('@SetRunOwnerRHS');
});

Cypress.Commands.add('assertRunDetailsPageRenderComplete', (expectedRunOwner) => {
    // LHS uses position:fixed — use 'exist' to avoid Cypress 15 strict visibility checks
    cy.findByTestId('lhs-navigation').should('exist').within(() => {
        cy.contains('Playbooks').should('exist');
        cy.contains('Runs').should('exist');
    });
    cy.get('#playbooks-sidebar-right').should('be.visible').within(() => {
        cy.findByTestId('assignee-profile-selector').should('contain', expectedRunOwner);
        cy.findAllByTestId('timeline-item', {exact: false}).should('have.length.of.at.least', 1);
        cy.findAllByTestId('profile-option', {exact: false}).should('have.length.of.at.least', 1);
    });
});

/**
 * Assert that a run in the runs list shows the expected sequential ID badge.
 * @param {String} runName - The run name to locate in the list
 * @param {String} expectedIdFragment - Substring expected inside the sequential-id-badge
 */
Cypress.Commands.add('playbooksAssertSequentialIdInList', (runName, expectedIdFragment) => {
    cy.playbooksGetRunListRow(runName).findByTestId('run-sequential-id').should('contain', expectedIdFragment);
});

/**
 * Navigate to the playbook outline page and open the RunPlaybook modal.
 * This is the common 2-step preamble used before filling in the run modal.
 * @param {String} playbookId - The playbook ID
 */
Cypress.Commands.add('playbooksOpenRunModal', (playbookId) => {
    cy.visit(`/playbooks/playbooks/${playbookId}/outline`);
    cy.findByTestId('run-playbook').should('not.be.disabled').click();
});

/**
 * Finish a run via the RHS Finish button in the run's channel.
 * Navigates to the run channel, clicks the Finish button in the RHS finish section,
 * and confirms the modal.
 * @param {String} teamName - The team name (slug) for the URL
 * @param {Object} run - The run object (must have channel_id)
 */
Cypress.Commands.add('playbooksFinishRunViaRHS', (teamName, run) => {
    cy.playbooksVisitRunChannel(teamName, run);
    cy.findByTestId('rhs-finish-section').findByRole('button', {name: /finish/i}).click();
    cy.playbooksConfirmFinishModal();
});

/**
 * Set a run property value by property name via the complementary (RHS) sidebar
 * on the run details page. Builds the testId from the property name, scopes to
 * the RHS sidebar via findByRole('complementary'), and waits for the mutation.
 *
 * Use this on the /playbooks/runs/:id page where the sidebar is rendered as
 * `role="complementary"`. For the channel-view RHS, use playbooksSetRunPropertyViaUI.
 *
 * @param {String} propertyName - The display name of the property (e.g. 'Priority')
 * @param {String} value        - The option name to select
 */
Cypress.Commands.add('playbooksSetRunPropertyViaRHS', (propertyName, value) => {
    const testId = `run-property-${propertyName.toLowerCase().replace(/\s+/g, '-')}`;

    cy.playbooksInterceptGraphQLMutation('SetRunPropertyValue');

    cy.findByTestId(testId).within(() => {
        cy.findByTestId('property-value').click();
    });

    cy.contains('.property-select__option', value).click();

    cy.wait('@SetRunPropertyValue');
});

/**
 * Extract the run ID from the current /playbooks/runs/:id URL.
 * Asserts the current URL includes '/playbooks/runs/' before extracting.
 * Returns a Cypress chain yielding the run ID string so callers can
 * chain .then((runId) => { ... }) for API assertions.
 *
 * Usage:
 *   cy.playbooksGetRunIdFromUrl().then((runId) => {
 *       cy.apiGetPlaybookRun(runId).then(({body: run}) => {
 *           expect(run.name).to.include('Expected');
 *       });
 *   });
 */
Cypress.Commands.add('playbooksGetRunIdFromUrl', () => {
    cy.url().should('include', '/playbooks/runs/');
    return cy.url().then((url) => {
        const runId = url.split('/playbooks/runs/')[1].split('?')[0];
        return cy.wrap(runId);
    });
});

/**
 * Navigate to a playbook editor page.
 * @param {String} playbookId - The playbook ID
 * @param {String} [tab='outline'] - The tab to navigate to (e.g. 'outline', 'attributes')
 */
Cypress.Commands.add('visitPlaybookEditor', (playbookId, tab = 'outline') => {
    cy.visit(`/playbooks/playbooks/${playbookId}/${tab}`);
});
