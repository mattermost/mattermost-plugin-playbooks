// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';
const playbookRunStartCommand = '/playbook run';

Cypress.Commands.add('startPlaybookRun', (playbookName, playbookRunName) => {
    // # Wait for the Run playbook modal (select-playbook step)
    cy.get('#playbooks_run_playbook_dialog').should('exist');

    // # Click the playbook by name in the selector list
    cy.get('#playbooks_run_playbook_dialog').findByText(playbookName).click();

    // # Now in run-details step — fill in the run name
    cy.findByTestId('run-name-input').clear().type(playbookRunName);

    // # Submit
    cy.findByRole('button', {name: /start run/i}).click();

    cy.get('#playbooks_run_playbook_dialog').should('not.exist');
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
 * Click the confirm button in the current confirmation modal.
 * Asserts the modal is visible first.
 */
Cypress.Commands.add('playbooksConfirmModal', () => {
    cy.get('#confirmModal').should('be.visible');
    cy.get('#confirmModal').find('#confirmModalButton').click();
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
 * Assert the state of a checklist item checkbox by index.
 * @param {Number} itemIndex - Zero-based index into checkbox-item-container elements
 * @param {Object} opts
 * @param {Boolean} [opts.disabled] - true → assert disabled; false → assert not disabled
 * @param {Boolean} [opts.checked]  - true → assert checked;  false → assert not checked
 */
Cypress.Commands.add('playbooksAssertChecklistItem', (itemIndex, {disabled, checked} = {}) => {
    cy.findByTestId('run-checklist-section').
        findAllByTestId('checkbox-item-container').
        eq(itemIndex).
        within(() => {
            if (disabled === true) {
                cy.findByTestId('task-checkbox').should('be.disabled');
            } else if (disabled === false) {
                cy.findByTestId('task-checkbox').should('not.have.attr', 'disabled');
            }
            if (checked === true) {
                cy.findByTestId('task-checkbox').should('be.checked');
            } else if (checked === false) {
                cy.findByTestId('task-checkbox').should('not.be.checked');
            }
        });
});

/**
 * Start a run via the RunPlaybook modal from the playbook outline page.
 * Navigates to the outline, fills in the run name, optionally sets property values, submits,
 * and waits for redirect.
 *
 * When propertyValues is provided, the run name input may be readonly (driven by a
 * channel_name_template). In that case the run name is not typed.
 *
 * @param {String} playbookId - The playbook ID to run
 * @param {String} runName - The name for the new run (ignored when the input is readonly)
 * @param {Object} [propertyValues] - Optional map of { propertyName: optionLabel } to set
 *   select property values in the modal before submitting.
 */
Cypress.Commands.add('playbooksStartRunViaModal', (playbookId, runName, propertyValues) => {
    cy.visit(`/playbooks/playbooks/${playbookId}/outline`);
    cy.findByTestId('run-playbook').click();

    // # Fill in the run name unless the input is readonly (template-driven)
    cy.findByTestId('run-name-input').then(($input) => {
        if (!$input.attr('readonly')) {
            cy.wrap($input).clear().type(runName);
        }
    });

    // # Set property values in the modal if provided
    if (propertyValues) {
        for (const [fieldName, optionLabel] of Object.entries(propertyValues)) {
            cy.findByText(fieldName).should('be.visible');
            cy.findByText('Select...').click();
            cy.findByText(optionLabel).click();
        }
    }

    cy.findByTestId('modal-confirm-button').click();
    cy.url().should('include', '/playbooks/runs/');
});

/**
 * Set a run property value via the UI on the run details page.
 *
 * Supports the following interaction types:
 *   - 'select'      (default) — click the value area, pick from dropdown
 *   - 'text'        — click to edit, type the value, blur to save
 *   - 'multiselect' — click the value area, pick one option from dropdown
 *   - 'clear'       — open the value area and click the clear/remove option
 *
 * All types intercept and wait for the SetRunPropertyValue mutation so the caller
 * gets a reliable sync point before making assertions.
 *
 * @param {String} fieldTestId - The data-testid of the property container
 * @param {String} [value]     - The display text to select/type (not needed for 'clear')
 * @param {Object} [opts]
 * @param {String} [opts.type='select'] - Interaction type: 'select' | 'text' | 'multiselect' | 'clear'
 */
Cypress.Commands.add('playbooksSetRunPropertyViaUI', (fieldTestId, value, {type = 'select'} = {}) => {
    cy.playbooksInterceptGraphQLMutation('SetRunPropertyValue');

    if (type === 'text') {
        // PropertyTextInput auto-focuses via useEffect; there is no data-testid on the
        // raw <input> element, so we target the currently-focused element after the click.
        cy.findByTestId(fieldTestId).within(() => {
            cy.findByTestId('property-value').click();
        });
        cy.focused().clear().type(value);
        cy.get('body').click(0, 0);
    } else if (type === 'multiselect') {
        cy.findByTestId(fieldTestId).within(() => {
            cy.findByTestId('property-value').click();
        });
        cy.findByText(value).click();

        // Close the dropdown by clicking outside
        cy.get('body').click(0, 0);
    } else if (type === 'clear') {
        cy.findByTestId(fieldTestId).within(() => {
            cy.findByTestId('property-value').click();
        });
        cy.findByTestId('property-clear-value').click();
    } else {
        // Default: select type
        cy.findByTestId(fieldTestId).within(() => {
            cy.findByTestId('property-value').click();
        });
        cy.findByText(value).click();
    }

    cy.wait('@SetRunPropertyValue');
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
 * Intercept a playbook property field REST mutation and alias it for cy.wait().
 * method: 'POST' (add/duplicate), 'PUT' (update name/type/options), 'DELETE' (delete)
 * Aliases: AddPropertyField, SavePropertyField, DeletePropertyField
 */
Cypress.Commands.add('playbooksInterceptPropertyFieldMutation', (method, aliasOverride) => {
    const aliasMap = {POST: 'AddPropertyField', PUT: 'SavePropertyField', DELETE: 'DeletePropertyField'};
    const urlMap = {
        POST: '/plugins/playbooks/api/v0/playbooks/*/property_fields',
        PUT: '/plugins/playbooks/api/v0/playbooks/*/property_fields/*',
        DELETE: '/plugins/playbooks/api/v0/playbooks/*/property_fields/*',
    };
    const alias = aliasOverride || aliasMap[method];
    if (!urlMap[method]) {
        throw new Error(`playbooksInterceptPropertyFieldMutation: unsupported method "${method}"`);
    }
    cy.intercept(method, urlMap[method]).as(alias);
});

/**
 * Intercept the REST PUT that saves a playbook (client.ts savePlaybook).
 * Alias: SavePlaybook
 */
Cypress.Commands.add('playbooksInterceptPlaybookSave', () => {
    cy.intercept('PUT', '/plugins/playbooks/api/v0/playbooks/*').as('SavePlaybook');
});

/**
 * Intercept a playbook condition REST mutation and alias it for cy.wait().
 * method: 'POST' (create), 'PUT' (update), 'DELETE' (delete)
 * Aliases: CreateCondition, SaveCondition, DeleteCondition
 */
Cypress.Commands.add('playbooksInterceptConditionMutation', (method) => {
    const aliasMap = {POST: 'CreateCondition', PUT: 'SaveCondition', DELETE: 'DeleteCondition'};
    const urlMap = {
        POST: '/plugins/playbooks/api/v0/playbooks/*/conditions',
        PUT: '/plugins/playbooks/api/v0/playbooks/*/conditions/*',
        DELETE: '/plugins/playbooks/api/v0/playbooks/*/conditions/*',
    };
    const alias = aliasMap[method];
    if (!alias) {
        throw new Error(`playbooksInterceptConditionMutation: unsupported method "${method}"`);
    }
    cy.intercept(method, urlMap[method]).as(alias);
});

/**
 * Intercept the REST call that toggles a checklist item's state (PUT …/state).
 * Alias: @SetChecklistItemState
 *
 * Usage:
 *   cy.playbooksInterceptChecklistItemState();
 *   cy.findByTestId('task-checkbox').click();
 *   cy.wait('@SetChecklistItemState');
 */
Cypress.Commands.add('playbooksInterceptChecklistItemState', (alias = 'SetChecklistItemState') => {
    cy.intercept('PUT', '/plugins/playbooks/api/v0/runs/*/checklists/*/item/*/state').as(alias);
});

/**
 * Change the run owner via the RHS profile selector.
 * Must be called while already on the run's channel page (after playbooksVisitRunChannel).
 * @param {String} newOwnerUsername - Username of the new owner to select
 */
Cypress.Commands.add('playbooksChangeRunOwnerViaRHS', (newOwnerUsername) => {
    cy.playbooksInterceptGraphQLMutation('ChangeRunOwner');
    cy.findByTestId('owner-profile-selector').click();

    // Profiles are loaded asynchronously via useProfilesInTeam. The dropdown
    // options refresh once the API response arrives and Redux updates, so we
    // wait up to HALF_MIN for the option to become available.
    cy.contains('.playbook-react-select__option', newOwnerUsername, {timeout: TIMEOUTS.HALF_MIN}).click();
    cy.wait('@ChangeRunOwner');
});

/**
 * Change the run owner via the owner selector on the run details page (/playbooks/runs/:id).
 * The run details page uses a REST POST to /runs/:id/owner (not the ChangeRunOwner GraphQL mutation
 * used by the channel RHS), so we intercept the REST endpoint.
 * @param {String} newOwnerUsername - Username of the new owner to select
 */
Cypress.Commands.add('playbooksChangeRunOwnerOnRunPage', (newOwnerUsername) => {
    cy.intercept('POST', '/plugins/playbooks/api/v0/runs/*/owner').as('SetRunOwner');
    cy.findByTestId('runinfo-owner').within(() => {
        cy.findByTestId('assignee-profile-selector').click();
    });
    cy.contains('.playbook-react-select__option', newOwnerUsername, {timeout: TIMEOUTS.HALF_MIN}).click();
    cy.wait('@SetRunOwner');
});

/**
 * Select a playbook in the runs list playbook filter dropdown.
 * Clicking the filter button opens a ReactSelect dropdown; clicking the option sets
 * fetchParams.playbook_id so the list enters single-playbook mode.
 * @param {String} playbookTitle - The title of the playbook to select
 */
Cypress.Commands.add('playbooksFilterByPlaybook', (playbookTitle) => {
    cy.findByTestId('playbook-filter').click();
    cy.get('.playbook-react-select__option').contains(playbookTitle).click();
});

/**
 * Find a run card in the RHS runs list by run name.
 * @param {String} runName - The name of the run to find
 */
Cypress.Commands.add('playbooksGetRHSRunCard', (runName) => {
    return cy.findByTestId('rhs-runs-list').contains('[data-testid="run-list-card"]', runName);
});

/**
 * Get a property field row in the playbook editor by zero-based index.
 * @param {Number} index - Zero-based row index
 */
Cypress.Commands.add('playbooksGetPropertyFieldRow', (index) => {
    return cy.findAllByTestId('property-field-row').eq(index);
});

/**
 * Find a run property row in the run details page by property name.
 * Returns the row element as a Cypress subject for chaining .within() or assertions.
 * @param {String} propertyName - The display name of the property field
 */
Cypress.Commands.add('playbooksGetRunPropertyRow', (propertyName) => {
    return cy.findByTestId('run-properties-section').
        findAllByTestId('run-property-row').
        filter(`:has([data-testid="property-label"]:contains("${propertyName}"))`);
});

/**
 * Click a boolean toggle (by testId) and confirm the resulting modal.
 * Used for toggles that show a confirmation dialog when enabling.
 * @param {String} toggleTestId - data-testid of the toggle container
 */
Cypress.Commands.add('playbooksToggleWithConfirmation', (toggleTestId) => {
    cy.findByTestId(toggleTestId).find('label').click();
    cy.playbooksConfirmModal();
});

/**
 * Assert a top-level property on the run fetched from the current page URL.
 * Extracts the run ID from the URL path, fetches the run via API, then asserts.
 * @param {String} propertyName - Top-level property name on the run object (e.g. 'owner_user_id')
 * @param {*} expectedValue - The expected value
 */
Cypress.Commands.add('playbooksAssertRunPropertyFromUrl', (propertyName, expectedValue) => {
    cy.url().should('include', '/playbooks/runs/');
    cy.url().then((url) => {
        const runId = url.split('/playbooks/runs/')[1].split('?')[0];
        cy.apiGetPlaybookRun(runId).then(({body: run}) => {
            expect(run[propertyName]).to.equal(expectedValue);
        });
    });
});

/**
 * Assert that the run name template preview shows the expected resolved value.
 * The dialog must already be open. Looks for the "Preview:" label and checks
 * that the adjacent preview text contains the expected substring.
 *
 * @param {String} expectedFragment - Substring expected in the preview text
 */
Cypress.Commands.add('playbooksAssertTemplatePreview', (expectedFragment) => {
    cy.findByText('Preview:').should('be.visible').
        parent().
        invoke('text').
        should('contain', expectedFragment);
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
 * Find the checklist item container for a task by its title within the run checklist section.
 * @param {String} title - The task title to search for
 */
Cypress.Commands.add('playbooksFindTaskItem', (title) => {
    return cy.findByTestId('run-checklist-section').findByText(title).
        parents('[data-testid="checkbox-item-container"]');
});

/**
 * Navigate to the playbook outline page and open the task editor for the named task.
 * @param {String} playbookId - The playbook ID
 * @param {String} taskTitle - The task title to open for editing
 */
Cypress.Commands.add('playbooksOpenTaskAssigneeEditor', (playbookId, taskTitle) => {
    cy.visit('/playbooks/playbooks/' + playbookId + '/outline');
    cy.get('#checklists').within(() => {
        cy.findByText(taskTitle).trigger('mouseover');
        cy.findByTestId('hover-menu-edit-button').click();
    });
});

/**
 * Close the currently open task editor by clicking the Save button.
 */
Cypress.Commands.add('playbooksSaveTaskEdit', () => {
    cy.get('#checklists').within(() => {
        cy.findByTestId('checklist-item-save-button').click();
    });
});

/**
 * Save the current task edit (if any) then re-open the editor for the named task.
 * @param {String} taskTitle - The task title to re-open for editing
 */
Cypress.Commands.add('playbooksReopenTaskAssigneeEditor', (taskTitle) => {
    cy.playbooksSaveTaskEdit();
    cy.get('#checklists').within(() => {
        cy.findByText(taskTitle).trigger('mouseover');
        cy.findByTestId('hover-menu-edit-button').click();
    });
});

/**
 * Complete the checklist task at the given zero-based index via the UI.
 * Intercepts and waits for the SetChecklistItemState mutation for reliable sync.
 * @param {Number} index - Zero-based task index within the checklist
 */
Cypress.Commands.add('playbooksCompleteTaskAtIndex', (index) => {
    cy.playbooksInterceptChecklistItemState();
    cy.findByTestId('run-checklist-section').
        findAllByTestId('checkbox-item-container').
        eq(index).
        findByTestId('task-checkbox').
        click();
    cy.wait('@SetChecklistItemState');
});

// typeEscape escapes opening curly braces so cy.type() treats them as literal characters.
// Cypress uses {{} to type a literal "{"; closing "}" is always typed literally.
const typeEscape = (str) => str.replace(/{/g, '{{}');

/**
 * Post a status update via the UI slash command and return the resolved message
 * from the resulting channel post (server resolves templates before storing).
 * @param {String} teamName - The team name for navigating to the run's channel
 * @param {Object} run - The run object (must have id)
 * @param {String} message - The status update message (may contain template tokens)
 * @returns Cypress chain yielding the resolved post message string
 */
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

/**
 * Assert that a run in the runs list shows the expected sequential ID badge.
 * @param {String} runName - The run name to locate in the list
 * @param {String} expectedIdFragment - Substring expected inside the sequential-id-badge
 */
Cypress.Commands.add('playbooksAssertSequentialIdInList', (runName, expectedIdFragment) => {
    cy.get('#playbookRunList').findByText(runName).
        parents('[data-testid="run-list-item"]').
        findByTestId('run-sequential-id').
        should('contain', expectedIdFragment);
});

/**
 * Add a property field to a playbook via the Attributes page in the playbook editor.
 * Navigates to /playbooks/playbooks/{playbookId}/attributes, clicks "Add attribute",
 * fills in the name, changes the type if needed, then saves.
 *
 * Supported types: 'text' (default), 'select', 'multi-select', 'url', 'date', 'user', 'multi-user'
 *
 * @param {String} playbookId - The playbook ID
 * @param {String} fieldName  - The attribute name to type
 * @param {String} [fieldType='text'] - The attribute type
 * @param {Array}  [options=[]] - Option names for select/multi-select types (e.g. ['Alpha', 'Bravo'])
 */
Cypress.Commands.add('playbooksAddPropertyFieldViaUI', (playbookId, fieldName, fieldType = 'text', options = []) => {
    cy.visit('/playbooks/playbooks/' + playbookId + '/attributes');

    // # Click "Add attribute" (text matches both "Add attribute" and "Add your first attribute")
    // Property field creation uses a REST POST, not the UpdatePlaybook GraphQL mutation.
    cy.playbooksInterceptPropertyFieldMutation('POST');
    cy.findByRole('button', {name: /add.*attribute/i}).click();
    cy.wait('@AddPropertyField');

    // # Fill in the name and blur to save via REST PUT
    cy.findAllByTestId('property-field-row').last().within(() => {
        cy.findByLabelText('Attribute name').clear().type(fieldName);
    });
    cy.playbooksInterceptPropertyFieldMutation('PUT', 'SavePropertyFieldName');
    cy.get('body').click(0, 0);
    cy.wait('@SavePropertyFieldName');

    // # Change type if not text — also saved via REST PUT
    if (fieldType !== 'text') {
        cy.findAllByTestId('property-field-row').last().within(() => {
            cy.findByRole('button', {name: 'Change attribute type'}).trigger('click');
        });
        cy.playbooksInterceptPropertyFieldMutation('PUT', 'SavePropertyFieldType');
        cy.findByText(new RegExp('^' + fieldType + '$', 'i')).click();
        cy.wait('@SavePropertyFieldType');
    }

    // # Add options for select/multi-select types
    if (options.length > 0 && (fieldType === 'select' || fieldType === 'multi-select')) {
        cy.findAllByTestId('property-field-row').last().within(() => {
            options.forEach((optionText, index) => {
                if (index > 0) {
                    cy.findByRole('button', {name: 'Add value'}).click();
                    cy.waitForGraphQLQueries();
                }

                cy.findAllByText(/^Option \d+$/).last().parent().as('optEl');
                cy.get('@optEl').click();
                cy.waitUntil(
                    () => cy.get('@optEl').then(($el) => $el.attr('aria-controls') !== undefined),
                    {timeout: 2000, interval: 100},
                );
                cy.get('@optEl').invoke('attr', 'aria-controls').then((ac) => {
                    const escapedId = ac.replace(/:/g, '\\:');
                    cy.document().its('body').find(`#${escapedId}`).within(() => {
                        cy.findByPlaceholderText('Enter value name').clear().type(`${optionText}{enter}`);
                    });
                });
                cy.waitForGraphQLQueries();
            });
        });

        // # Click outside to close any open option editor
        cy.get('body').click(0, 0);
    }
});

/**
 * Navigate to the playbook outline page and open the RunPlaybook modal.
 * This is the common 2-step preamble used before filling in the run modal.
 * @param {String} playbookId - The playbook ID
 */
Cypress.Commands.add('playbooksOpenRunModal', (playbookId) => {
    cy.visit(`/playbooks/playbooks/${playbookId}/outline`);
    cy.findByTestId('run-playbook').click();
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
