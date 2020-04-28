// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Upload a file on target input given a filename and mime type
 * @param {String} targetInput - Target input to upload a file
 * @param {String} workflow - JSON workflow
 * @param {String} fileName - assigned filename
 */
Cypress.Commands.add('uploadWorkflow', {prevSubject: true}, (targetInput, workflow, fileName) => {
    cy.get(targetInput).upload(
        {fileContent: JSON.stringify(workflow), fileName, mimeType: 'application/json'},
        {subjectType: 'input', force: true},
    );
});
