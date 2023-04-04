# ⛔️ Obsolete
The functionality of Mattermost Playbooks is now part of the core Mattermost product. New pull requests and issues should be filed against https://github.com/mattermost/mattermost-server.

This repository exists to continue supporting plugin-based versions of Mattermost Playbooks as supported in Mattermost v7.9 and earlier.

# Mattermost Playbooks

Mattermost Playbooks allows your team to create and run playbooks from within Mattermost. For configuration and administration information visit our [documentation](https://docs.mattermost.com/guides/playbooks.html).

![Mattermost Playbooks](assets/incident_response.png)

## Development Builds
In your `mattermost-server` configuration (`config/config.json`), set the following values:

`ServiceSettings.EnableLocalMode: true`

`PluginSettings.EnableUploads: true`

and restart the server. Once done, the relevant `make` commands should be able to install builds. Those commands are:

`make deploy` - builds and installs the plugin a single time

`make watch` - continuously builds and installs when files change

which are run from the repo root.

## License

This repository is licensed under the Apache 2.0 License, except for the [server/enterprise](server/enterprise) directory which is licensed under the [Mattermost Source Available License](LICENSE.enterprise). See [Mattermost Source Available License](https://docs.mattermost.com/overview/faq.html#mattermost-source-available-license) to learn more.

Although a valid Mattermost Enterprise license is required to access all features if using this plugin in production, the [Mattermost Source Available License](LICENSE) allows you to compile and test this plugin in development and testing environments without a Mattermost Enterprise license. As such, we welcome community contributions to this plugin.

If you're running Mattermost Starter and don't already have a valid license, you can obtain a trial license from **System Console > Edition and License**. If you're running the Team Edition of Mattermost, including when you run the server directly from source, you may instead configure your server to enable both testing (`ServiceSettings.EnableTesting`) and developer mode (`ServiceSettings.EnableDeveloper`). These settings are not recommended in production environments. See [Contributing](#contributing) to learn more about how to set up your development environment.
