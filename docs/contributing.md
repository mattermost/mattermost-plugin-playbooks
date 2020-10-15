# Contribution Guidelines

There are two things you need to do before starting development on the plugin:

1.  You'll need a running server for the plugin deployment, and the web app to manually test your changes. If you have never set up your Mattermost development environment, do so following the instructions for both the [server](https://developers.mattermost.com/contribute/server/developer-setup/) and the [web app](https://developers.mattermost.com/contribute/webapp/developer-setup/).
2.  Normally, the plugin needs a Mattermost Enterprise Edition E20 License to start. However, you can bypass this and run it for development by configuring your Mattermost server to enable both testing and developer mode. You can do so directly on the server's `config/config.json` file, setting both `ServiceSettings.EnableTesting` and `ServiceSettings.EnableDeveloper` to `true` (don't forget to restart the server afterwards). You can also configure these settings via the System Console, under **Environment > Developer**. See [License](#License) for more information.

If this is the first time you're contributing to a Mattermost plugin, the [plugin documentation](https://developers.mattermost.com/extend/plugins/) is a good read to go through before diving into the code.

## Set up your development environment

You have a running server and web app, and you have read the plugin documentation. Now you only need to do the usual dance: `clone`, `cd`, `make`.

```sh
# Change the URL below to your fork if you plan to make a PR!
git clone git@github.com:mattermost/mattermost-plugin-incident-response.git
cd mattermost-plugin-incident-response
make
```

The default target for `make` triggers the commands `check-style`, `test`, and `dist`: if everything works as expected, you'll end up with a packaged plugin in the `dist/` directory, ready to be uploaded to Mattermost via the System Console. There are more `make` commands: run `make help` to get a comprehensive list of them.

One particularly interesting command is `make deploy`, which looks for a running Mattermost server, and directly deploys the plugin to it and enables it via the API. For this to work, you first need to set up a few environment variables:

```sh
# This is the default URL for a local Mattermost server.
# Change it if your local instance is served elsewhere.
export MM_SERVICESETTINGS_SITEURL=http://localhost:8065

# This is the admin account created when generating sample data in the server with make test-data.
# You can change it to the credentials of any admin account.
export MM_ADMIN_USERNAME="sysadmin"
export MM_ADMIN_PASSWORD="Sys@dmin-sample1"

# You can now deploy the plugin from the comfort of your terminal!
make deploy
```

### Testing

#### Unit tests

Running the unit tests for both the server and the web app is as easy as running:

```sh
make test
```

Please note that the tests of the [`sqlstore`](server/sqlstore) package need a running server to work: they create temporal databases using the PostgreSQL and MySQL containers created by the server.

If you want to run only the tests of the server part, you may do so with the usual `go test` command, as in:

```sh
# Run all server tests
go test ./server/...

# Run only the tests of the incident package
go test ./server/incident
```

If you want to run only the tests of the web app part, you may do so with `npm`:

```sh
cd webapp && npm run test
```

#### End to end tests

Our end to end (E2E) tests are implemented using [Cypress](https://docs.cypress.io/) and all of them live under the `tests-e2e/` directory. You need to install the Cypress dependencies once by doing:

```sh
cd tests-e2e
npm install
```

Running the tests successfully will require test data in the server, so make sure to generate some before running the E2E tests. To do so, do the following:

```sh
cd path/to/your/local/mattermost-server
make test-data
```

Now you are ready to run the tests from within `tests-e2e/`. There are two alternative ways:

1. Run `npm test` to run all tests headlessly.
2. Run `npm run cypress:open` to open the Cypress dashboard, select the test spec you want and run it.

For a full documentation on E2E tests for Mattermost web app and troubleshooting, please see https://developers.mattermost.com/contribute/webapp/end-to-end-tests/.
