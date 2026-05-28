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
    // Match both legacy "Post update" and the current "Status update" dialog titles.
    return cy.findByRole('dialog', {name: /(?:post|status) update/i});
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
 * Register an intercept alias for the REST PATCH /playbooks/:id endpoint.
 * Use when waiting for the debounced channel_name_template save triggered by editor changes.
 *
 * Usage:
 *   cy.playbooksInterceptPatchPlaybook();
 *   // ... trigger UI action ...
 *   cy.wait('@PatchPlaybook');
 */
Cypress.Commands.add('playbooksInterceptPatchPlaybook', () => {
    cy.intercept('PATCH', '/plugins/playbooks/api/v0/playbooks/*').as('PatchPlaybook');
});

/**
 * Assert the run finish confirmation modal is visible and confirm it.
 * The modal h1 must contain "Confirm finish".
 */
Cypress.Commands.add('playbooksConfirmFinishModal', () => {
    cy.get('#confirmModal').should('be.visible');
    cy.get('#confirmModal').find('h1').should('contain', 'Confirm finish');
    cy.get('#confirmModal').find('#confirmModalButton').click();
    cy.get('#confirmModal').should('not.exist');
});

/**
 * Intercept the REST PUT that saves a playbook (client.ts savePlaybook).
 * Alias: SavePlaybook
 */
Cypress.Commands.add('playbooksInterceptPlaybookSave', () => {
    cy.intercept('PUT', '/plugins/playbooks/api/v0/playbooks/*').as('SavePlaybook');
});

/**
 * Navigate to a playbook editor page.
 * @param {String} playbookId - The playbook ID
 * @param {String} [tab='outline'] - The tab to navigate to (e.g. 'outline', 'attributes')
 */
Cypress.Commands.add('playbooksVisitEditor', (playbookId, tab = 'outline') => {
    cy.visit(`/playbooks/playbooks/${playbookId}/${tab}`);
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

Cypress.Commands.add('playbooksChangeRunOwnerViaRHS', (newOwnerUsername) => {
    cy.intercept('POST', '/plugins/playbooks/api/v0/runs/*/owner').as('SetRunOwner');
    cy.findByTestId('owner-profile-selector', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').click();

    // Profiles are loaded asynchronously via useProfilesInTeam. The dropdown
    // options refresh once the API response arrives and Redux updates, so we
    // wait up to HALF_MIN for the option to become available.
    cy.contains('.playbook-react-select__option', newOwnerUsername, {timeout: TIMEOUTS.HALF_MIN}).click();
    cy.wait('@SetRunOwner').its('response.statusCode').should('be.oneOf', [200, 204]);

    cy.findByTestId('owner-profile-selector', {timeout: TIMEOUTS.HALF_MIN}).should('contain', newOwnerUsername);
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
 * Find a run row in the runs list (#playbookRunList) by run name.
 * @param {String} runName - The run name to locate in the list
 */
Cypress.Commands.add('playbooksGetRunListRow', (runName) => {
    return cy.findByTestId('playbookRunList').contains('[data-testid="run-list-item"]', runName);
});

/**
 * Intercept the REST call that toggles a checklist item's state (PUT …/state).
 * Alias: @SetChecklistItemState
 */
Cypress.Commands.add('playbooksInterceptChecklistItemState', (alias = 'SetChecklistItemState') => {
    cy.intercept('PUT', '/plugins/playbooks/api/v0/runs/*/checklists/*/item/*/state').as(alias);
});

/**
 * Complete the checklist task at the given zero-based index via the UI.
 * @param {Number} index - Zero-based task index within the checklist
 */
Cypress.Commands.add('playbooksCompleteTaskAtIndex', (index) => {
    const alias = `SetChecklistItemState_${index}`;
    cy.playbooksInterceptChecklistItemState(alias);
    cy.findByTestId('run-checklist-section').
        findAllByTestId('checkbox-item-container').
        eq(index).
        find('input[type="checkbox"]').
        should('not.be.checked');
    cy.findByTestId('run-checklist-section').
        findAllByTestId('checkbox-item-container').
        eq(index).
        find('input[type="checkbox"]').
        click();
    cy.wait(`@${alias}`);
});

Cypress.Commands.add('playbooksConfirmModal', () => {
    cy.get('#confirmModal').should('be.visible');
    cy.get('#confirmModal').find('#confirmModalButton').click();

    // Wait for dismissal so callers don't race a still-open modal on the next action.
    cy.get('#confirmModal').should('not.exist');
});

Cypress.Commands.add('playbooksChangeRunOwnerViaRHS', (newOwnerUsername) => {
    cy.intercept('POST', '/plugins/playbooks/api/v0/runs/*/owner').as('SetRunOwner');
    cy.findByTestId('owner-profile-selector', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').click();

    // Profiles are loaded asynchronously via useProfilesInTeam. The dropdown
    // options refresh once the API response arrives and Redux updates, so we
    // wait up to HALF_MIN for the option to become available.
    cy.contains('.playbook-react-select__option', newOwnerUsername, {timeout: TIMEOUTS.HALF_MIN}).click();
    cy.wait('@SetRunOwner').its('response.statusCode').should('be.oneOf', [200, 204]);
    cy.findByTestId('owner-profile-selector', {timeout: TIMEOUTS.HALF_MIN}).should('contain', newOwnerUsername);
});

Cypress.Commands.add('playbooksConfirmFinishModal', () => {
    cy.get('#confirmModal').should('be.visible');
    cy.get('#confirmModal').find('h1').should('contain', 'Confirm finish');
    cy.get('#confirmModal').find('#confirmModalButton').click();
    cy.get('#confirmModal').should('not.exist');
});

Cypress.Commands.add('playbooksInterceptGraphQLMutation', (operationName) => {
    cy.intercept('POST', '/plugins/playbooks/api/v0/query', (req) => {
        if (req.body && req.body.operationName === operationName) {
            req.alias = operationName;
        }
    });
});

Cypress.Commands.add('playbooksOpenTaskAssigneeEditor', (playbookId, taskTitle) => {
    cy.visit('/playbooks/playbooks/' + playbookId + '/outline');
    cy.get('#checklists').within(() => {
        cy.findByText(taskTitle).trigger('mouseover');
        cy.findByTestId('hover-menu-edit-button').click();
    });
});

Cypress.Commands.add('playbooksFindTaskItem', (title) => {
    return cy.findByTestId('run-checklist-section').findByText(title).
        parents('[data-testid="checkbox-item-container"]');
});

Cypress.Commands.add('playbooksToggleWithConfirmation', (toggleTestId, playbookId) => {
    if (playbookId) {
        cy.intercept('PUT', `**/api/v0/playbooks/${playbookId}`).as('togglePersist');
    }
    cy.findByTestId(toggleTestId).find('label').click();
    cy.playbooksConfirmModal();
    if (playbookId) {
        cy.wait('@togglePersist').its('response.statusCode').should('be.oneOf', [200, 204]);
    }
});

Cypress.Commands.add('visitPlaybookEditor', (playbookId, tab = 'outline') => {
    cy.visit(`/playbooks/playbooks/${playbookId}/${tab}`);
});

/**
 * Navigate to the playbook outline page and open the RunPlaybook modal.
 * This is the common 2-step preamble used before filling in the run modal.
 * @param {String} playbookId - The playbook ID
 */
Cypress.Commands.add('playbooksOpenRunModal', (playbookId) => {
    cy.visit(`/playbooks/playbooks/${playbookId}/outline`);
    cy.findByTestId('run-playbook').should('be.visible').and('not.be.disabled').click();
});

Cypress.Commands.add('playbooksStartRunViaModal', (playbookId, runName) => {
    cy.playbooksOpenRunModal(playbookId);
    cy.findByTestId('run-name-input').then(($input) => {
        if (!$input.attr('readonly')) {
            cy.wrap($input).clear().type(runName);
        }
    });
    cy.findByTestId('modal-confirm-button').click();
    cy.url().should('include', '/playbooks/runs/');
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
    cy.findByTestId('run-finish-section').findByRole('button', {name: /finish/i}).click();
    cy.get('#confirmModal').should('be.visible');
    cy.get('#confirmModal').find('#confirmModalButton').click();
    cy.get('#confirmModal').should('not.exist');
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
Cypress.Commands.add('playbooksSetRunPropertyViaRHS', (propertyName, value, {type = 'select'} = {}) => {
    const testId = `run-property-${propertyName.toLowerCase().replace(/\s+/g, '-')}`;

    cy.playbooksInterceptGraphQLMutation('SetRunPropertyValue');

    cy.findByTestId(testId).within(() => {
        cy.findByTestId('property-value').click();
    });

    if (type === 'text') {
        cy.focused().clear();
        cy.focused().type(value);
        cy.get('body').click(0, 0);
    } else {
        cy.contains('.property-select__option', value).click();
    }

    cy.wait('@SetRunPropertyValue');

    // Confirm the UI reflects the saved value before returning. This ensures
    // the re-render triggered by the mutation has settled, preventing DOM
    // detachment when callers chain multiple property sets sequentially.
    cy.findByTestId(testId).should('contain', value);
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
        const urlObj = new URL(url);
        const [, afterRuns = ''] = urlObj.pathname.split('/playbooks/runs/');
        const runId = afterRuns.split('/')[0];
        return cy.wrap(runId);
    });
});

// typeEscape escapes opening curly braces so cy.type() treats them as literal characters.
const typeEscape = (str) => str.replace(/{/g, '{{}');

Cypress.Commands.add('playbooksPostStatusUpdateViaUI', (teamName, run, message) => {
    cy.playbooksVisitRunChannel(teamName, run);
    cy.uiPostMessageQuickly('/playbook update');
    cy.getStatusUpdateDialog().within(() => {
        cy.findByTestId('update_run_status_textbox').clear().type(typeEscape(message));
        cy.findByTestId('modal-confirm-button').click();
    });
    cy.getStatusUpdateDialog().should('not.exist');
    return cy.getLastPostId().then((postId) => cy.apiGetPostMessage(postId));
});

// Post a status update from the run details page using the "Post update" button.
// The browser must already be on the run details page.
Cypress.Commands.add('playbooksPostStatusUpdateViaRunPage', (run, message) => {
    cy.findByTestId('post-update-button').click();
    cy.getStatusUpdateDialog().within(() => {
        cy.findByTestId('update_run_status_textbox').clear().type(typeEscape(message));
        cy.findByTestId('modal-confirm-button').click();
    });
    cy.getStatusUpdateDialog().should('not.exist');
    return cy.apiGetPlaybookRun(run.id).then(({body: updatedRun}) => {
        const statusPosts = updatedRun.status_posts || [];
        const lastPost = statusPosts[statusPosts.length - 1];
        return cy.apiGetPostMessage(lastPost.id);
    });
});
