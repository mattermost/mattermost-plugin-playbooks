// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const dns = require('node:dns');

const {defineConfig} = require('cypress');

const cypressPlugins = require('./cypress/plugins/index');

// Work around an issue on some platforms where localhost resolves to ipv6, but only with axios.
dns.setDefaultResultOrder('ipv4first');

module.exports = defineConfig({
    defaultCommandTimeout: 20000,
    taskTimeout: 20000,
    video: true,
    viewportWidth: 1300,
    env: {
        adminEmail: 'sysadmin@sample.mattermost.com',
        adminUsername: 'sysadmin',
        adminPassword: 'Sys@dmin-sample1',
        allowedUntrustedInternalConnections: 'localhost',
        dbClient: 'postgres',
        dbConnection:
        'postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable&connect_timeout=10',
        elasticsearchConnectionUrl: 'http://localhost:9200',
        firstTest: false,
        keycloakAppName: 'mattermost',
        keycloakBaseUrl: 'http://localhost:8484',
        keycloakUsername: 'mmuser',
        keycloakPassword: 'mostest',
        ldapServer: 'localhost',
        ldapPort: 389,
        minioAccessKey: 'minioaccesskey',
        minioSecretKey: 'miniosecretkey',
        minioS3Bucket: 'mattermost-test',
        minioS3Endpoint: 'localhost:9000',
        minioS3SSL: false,
        numberOfTrialUsers: 100,
        resetBeforeTest: false,
        runLDAPSync: false,
        secondServerURL: 'http://localhost/s/p',
        smtpUrl: 'http://localhost:10080',
        storybookUrl: 'http://localhost:6006/',
        webhookBaseUrl: 'http://localhost:3000',
        developerMode: false,
    },
    reporter: 'cypress-multi-reporters',
    reporterOptions: {
        configFile: 'reporter-config.json',
    },
    numTestsKeptInMemory: 5,
    e2e: {
        setupNodeEvents(on, config) {
            return cypressPlugins(on, config);
        },
        baseUrl: 'http://localhost:8065',
        excludeSpecPattern: '**/node_modules/**/*',
        specPattern: '../**/*_spec.js',
    },
});
