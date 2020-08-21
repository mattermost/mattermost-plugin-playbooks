# Mattermost Incident Response Plugin

This plugin allows you to coordinate and manage incidents within Mattermost.

## License

This repository is licensed under the [Mattermost Source Available License](LICENSE) and requires a valid Enterprise E20 license. See [Mattermost Source Available License](https://docs.mattermost.com/overview/faq.html#mattermost-source-available-license) to learn more.

## Community Contributions

A valid Mattermost Enterprise E20 license is required if using this plugin in production. However, the license allows free-of-charge and unrestricted use of the source code in development and testing environments. As such, we welcome community contributions to this plugin.

On startup, the plugin checks for a valid Mattermost Enterprise E20 license. If you're running the Enterprise Edition of the Mattermost server and don't already have a valid license, you can obtain a trial license from **System Console > Edition and License**. If you're running the Team Edition of the Mattermost server, including when you run the server directly from source, you may instead configure your server to enable both testing (`ServiceSettings.EnableTesting`) and developer mode (`ServiceSettings.EnableDeveloper`). These settings are not recommended in production environments.

##### Running E2E Tests:

_To run the Cypress E2E tests in your local environment, do the following:_

- cd to tests-e2e
- Run `npm install`
- Run `npm run cypress:open`
- Once Cypress dashboard opens, select the test spec and run.

- Running `npm test` from within the tests-e2e directory runs all the tests headlessly.

Running the tests successfully will require the test data, hence running `make test-data` will be required.

For a full documentation on E2E tests for webapp and troubleshooting, please see https://developers.mattermost.com/contribute/webapp/end-to-end-tests/
