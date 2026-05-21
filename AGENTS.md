# Agent Instructions

## Build Commands

- `make all` — check style, run tests, and build the plugin bundle
- `make check-style` — run linters (golangci-lint, eslint, stylelint, mattermost-govet)
- `make test` — run server and webapp unit tests
- `make server` — build the server binary
- `make webapp` — build the webapp bundle
- `make dist` — build and bundle the plugin (.tar.gz)
- `make deploy` — build and install the plugin into a running Mattermost server
- `make watch` — continuously build and install when files change
- `make clean` — remove all build artifacts

## Quick Checks

- `make check-style` — run all linters (Go + webapp)
- `make test` — run all tests (Go + webapp)
- `make dist` — build all assets

## Cursor Cloud Agents

- Cloud-agent environment files live in `.cursor/`.
- `.cursor/cursor.md` has cloud-only instructions for starting Mattermost with Docker and deploying this plugin.
- `.cursor/AGENTS.md` is generated from `.cursor/cursor.md` during cloud-agent startup and should not be committed.
