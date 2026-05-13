# AGENTS.md

## Cursor Cloud specific instructions

> **IMPORTANT**: Do NOT commit or push `AGENTS.md` to the repository. The update script generates `AGENTS.md` at runtime by copying `cursor.md`. If you see `AGENTS.md` as an untracked or modified file, add it to `.gitignore` or simply leave it unstaged — never `git add` it.

### Overview

This is the **Mattermost Playbooks** plugin (`mattermost-plugin-playbooks`). It is a Mattermost server plugin with a Go backend (`server/`) and React/TypeScript frontend (`webapp/`), bundled as a `.tar.gz` and deployed into a running Mattermost server instance.

### Services

| Service | Purpose | Port |
|---|---|---|
| **Mattermost Server** (Docker) | Host platform the plugin runs inside | `8065` |
| **PostgreSQL** (Docker) | Database for Mattermost + plugin data | `5432` |

Both run as Docker containers (`mattermost-server` and `mattermost-postgres`). The update script handles Docker installation and startup.

### Admin credentials

- Username: `admin`, Password: `Admin1234!`, Team: `test-team`

### Building and deploying

```bash
export MM_SERVICESETTINGS_SITEURL=http://localhost:8065
export MM_ADMIN_USERNAME=admin
export MM_ADMIN_PASSWORD='Admin1234!'
export MM_SERVICESETTINGS_ENABLEDEVELOPER=true
make deploy
```

`MM_SERVICESETTINGS_ENABLEDEVELOPER=true` causes only the current-platform binary to be built (faster).

### Running lint, tests, and type-checks

See `Makefile` targets and `webapp/package.json` scripts. Key commands:

- **Go vet**: `go vet ./...`
- **Webapp lint**: `cd webapp && npm run lint`
- **Webapp type-check**: `cd webapp && npm run check-types`
- **Webapp tests**: `cd webapp && npm run test` (Jest, 22 suites, ~5300 tests)
- **Go tests**: requires a running PostgreSQL (the Docker `mattermost-postgres` container suffices); run `make test`
- **Full lint**: `make check-style` (installs Go tools, runs ESLint, stylelint, golangci-lint, mattermost-govet)

### Gotchas

- **Node.js version**: `.nvmrc` specifies `24.11`. The update script installs Node 24.11.0 via `n` and disabling nvm is required (nvm overrides `/usr/local/bin/node`). Set `NVM_DIR=""` and reorder `PATH` to put `/usr/local/bin` first.
- **npm install flags**: webapp deps must be installed with `--ignore-scripts --legacy-peer-deps` (per `Makefile`).
- **Docker nested containers**: The VM runs inside a Firecracker microVM. Docker requires `fuse-overlayfs` storage driver and `iptables-legacy` to work correctly.
- **Mattermost local mode**: The Docker container mounts `/var/tmp` so the local socket at `/var/tmp/mattermost_local.socket` is accessible from the host, but `pluginctl` uses API auth by default when env vars are set. Set `MM_SERVICESETTINGS_SITEURL`, `MM_ADMIN_USERNAME`, and `MM_ADMIN_PASSWORD` for `make deploy`.
- **Container resumption**: On session start, the update script restarts existing Docker containers rather than recreating them (uses `docker start` on stopped containers). This preserves database state and plugin installations across sessions.
