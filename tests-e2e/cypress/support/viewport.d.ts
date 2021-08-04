// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Specific link to https://api.mattermost.com
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiWaitUntilMessagePostedIncludes`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {
        /**
         * Determine if the given element is visible within the viewport.
         * @param {string} element - query for given element
         * @returns {boolean} returns true if visible within the viewport
         *
         * @example
         *   cy.isInViewport('.playbook-run-user-select');
         */
        isInViewport(element: string): boolean;
    }
}
