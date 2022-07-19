const { defineConfig } = require('cypress')

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
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require('./cypress/plugins/index.js')(on, config)
    },
    baseUrl: 'http://localhost:8065',
    excludeSpecPattern: '**/node_modules/**/*',
    specPattern: '../**/*_spec.js',
  },
})
