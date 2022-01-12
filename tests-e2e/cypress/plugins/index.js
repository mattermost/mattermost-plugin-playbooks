// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */
const shell = require('shelljs');

const installLogsPrinter = require('cypress-terminal-report/src/installLogsPrinter');

const {
    dbGetActiveUserSessions,
    dbGetUser,
    dbGetUserSession,
    dbUpdateUserSession,
} = require('./db_request');
const clientRequest = require('./client_request');
const externalRequest = require('./external_request');
const fileExist = require('./file_exist');
const getRecentEmail = require('./get_recent_email');
const keycloakRequest = require('./keycloak_request');
const oktaRequest = require('./okta_request');
const postBotMessage = require('./post_bot_message');
const postIncomingWebhook = require('./post_incoming_webhook');
const postMessageAs = require('./post_message_as');
const urlHealthCheck = require('./url_health_check');
const reactToMessageAs = require('./react_to_message_as');
const logging = require('./logging');

const log = (message) => {
    console.log(message);
    return null;
};

module.exports = (on, config) => {
    on('task', {
        clientRequest,
        dbGetActiveUserSessions,
        dbGetUser,
        dbGetUserSession,
        dbUpdateUserSession,
        externalRequest,
        fileExist,
        getRecentEmail,
        keycloakRequest,
        log,
        oktaRequest,
        postBotMessage,
        postIncomingWebhook,
        postMessageAs,
        urlHealthCheck,
        reactToMessageAs,
        logging,
    });

    on('before:browser:launch', (browser = {}, launchOptions) => {
        if (browser.name === 'chrome' && !config.chromeWebSecurity) {
            launchOptions.args.push('--disable-features=CrossSiteDocumentBlockingIfIsolating,CrossSiteDocumentBlockingAlways,IsolateOrigins,site-per-process');
            launchOptions.args.push('--load-extension=cypress/extensions/Ignore-X-Frame-headers');
        }

        return launchOptions;
    });

    // generates timing data for use in .circleci/config.yml,
    // slightly different to `mocha-junit-reporter` which was used previously.
    // see `pull/951` for more info
    on('after:spec', (spec, results) => {
        const timeInMillis = results.stats.wallClockDuration;
        const millisPerSec = 1000;
        const timeInSec = timeInMillis / millisPerSec;
        const XMLResult = `
        <testsuite>
            <testcase name="${spec.name}" file="${spec.relative}" time="${timeInSec}">
            </testcase>
        </testsuite>`;

        shell.echo(XMLResult).toEnd('temp-results.txt');
    });

    installLogsPrinter(on);

    return config;
};
