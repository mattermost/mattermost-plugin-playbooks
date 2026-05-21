# Cursor Cloud Agent Guide

This repository uses a Dockerfile-backed Cursor Cloud Agent environment with Docker-in-Docker and browser automation support. The image includes Go, Node.js, Docker, Docker Compose, AWS CLI, `agent-browser`, and cached archives for:

- `mattermostdevelopment/mattermost-enterprise-edition:master` (`linux/amd64`)
- `postgres:16-alpine`

The start script boots `dockerd`, loads those image archives, and writes this file to `.cursor/AGENTS.md`.

## Useful Commands

- `make all` — lint, test, and build the plugin bundle.
- `make check-style` — run Go and webapp linters/type checks.
- `make test` — run server and webapp unit tests (Go tests require a running Postgres).
- `make dist` — build `dist/playbooks-<version>.tar.gz`.
- `make deploy` — build and deploy the plugin to Mattermost.
- `make watch` — rebuild the plugin and redeploy on webapp changes.
- `make logs-watch` — follow plugin logs after deployment.

Skip flags for faster setup:

- `CLOUD_AGENT_SKIP_GO_MOD=1` skips `go mod download`.
- `CLOUD_AGENT_SKIP_GO_TOOLS=1` skips Go tool installation.
- `CLOUD_AGENT_SKIP_WEBAPP_DEPS=1` skips webapp dependency installation.
- `CLOUD_AGENT_SKIP_IMAGE_LOAD=1` skips loading cached Docker image archives.

## Run Mattermost

Start Postgres and Mattermost from the preloaded images:

```bash
export MM_IMAGE=mattermostdevelopment/mattermost-enterprise-edition:master
export MM_PLATFORM=linux/amd64
export POSTGRES_IMAGE=postgres:16-alpine
export MM_DB_USER=mmuser
export MM_DB_PASSWORD=mmuser_password
export MM_DB_NAME=mattermost
export MM_ADMIN_USERNAME=admin
export MM_ADMIN_PASSWORD='Admin1234!'

docker network create mattermost-dev || true
docker rm -f mattermost mm-postgres 2>/dev/null || true
docker volume create mm-postgres-data

docker run -d \
  --name mm-postgres \
  --network mattermost-dev \
  -e POSTGRES_USER="$MM_DB_USER" \
  -e POSTGRES_PASSWORD="$MM_DB_PASSWORD" \
  -e POSTGRES_DB="$MM_DB_NAME" \
  --health-cmd='pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  --health-interval=5s \
  --health-timeout=5s \
  --health-retries=24 \
  -v mm-postgres-data:/var/lib/postgresql/data \
  "$POSTGRES_IMAGE"

until [ "$(docker inspect -f '{{.State.Health.Status}}' mm-postgres)" = "healthy" ]; do
  sleep 2
done

mkdir -p /tmp/mattermost/{config,data,logs,plugins,client-plugins,bleve-indexes}
chmod -R 777 /tmp/mattermost

docker run -d \
  --name mattermost \
  --platform "$MM_PLATFORM" \
  --network mattermost-dev \
  -p 8065:8065 \
  -e MM_SQLSETTINGS_DRIVERNAME=postgres \
  -e "MM_SQLSETTINGS_DATASOURCE=postgres://$MM_DB_USER:$MM_DB_PASSWORD@mm-postgres:5432/$MM_DB_NAME?sslmode=disable&connect_timeout=10" \
  -e MM_SERVICESETTINGS_SITEURL=http://localhost:8065 \
  -e MM_SERVICESETTINGS_ENABLEDEVELOPER=true \
  -e MM_SERVICESETTINGS_ENABLELOCALMODE=true \
  -e MM_PLUGINSETTINGS_ENABLEUPLOADS=true \
  -e MM_PLUGINSETTINGS_ENABLEMARKETPLACE=false \
  -v /tmp/mattermost/config:/mattermost/config \
  -v /tmp/mattermost/data:/mattermost/data \
  -v /tmp/mattermost/logs:/mattermost/logs \
  -v /tmp/mattermost/plugins:/mattermost/plugins \
  -v /tmp/mattermost/client-plugins:/mattermost/client/plugins \
  -v /tmp/mattermost/bleve-indexes:/mattermost/bleve-indexes \
  "$MM_IMAGE"
```

Wait for Mattermost, then create a system admin:

```bash
until curl -fsS http://localhost:8065/api/v4/system/ping | jq -e '.status == "OK"' >/dev/null; do
  sleep 2
done

docker exec mattermost mmctl --local user search "$MM_ADMIN_USERNAME" | grep -q "$MM_ADMIN_USERNAME" || \
  docker exec mattermost mmctl --local user create \
    --email admin@example.com \
    --username "$MM_ADMIN_USERNAME" \
    --password "$MM_ADMIN_PASSWORD" \
    --system-admin
```

Mattermost will be available on port `8065`.

## Deploy The Plugin

Deploy through the plugin API using the admin credentials:

```bash
export MM_SERVICESETTINGS_SITEURL=http://localhost:8065
export MM_ADMIN_USERNAME=admin
export MM_ADMIN_PASSWORD='Admin1234!'
export MM_SERVICESETTINGS_ENABLEDEVELOPER=true

make deploy
```

For iterative webapp work:

```bash
export MM_SERVICESETTINGS_SITEURL=http://localhost:8065
export MM_ADMIN_USERNAME=admin
export MM_ADMIN_PASSWORD='Admin1234!'
export MM_SERVICESETTINGS_ENABLEDEVELOPER=true

make watch
```

`MM_SERVICESETTINGS_ENABLEDEVELOPER=true` builds only the current-platform binary for faster deploy cycles.

## Drive The Mattermost UI

The Dockerfile installs `agent-browser` and Chrome runtime libraries so cloud agents can test Mattermost through the browser.

After Mattermost is running and the plugin is deployed, open the UI:

```bash
agent-browser open http://localhost:8065
```

Log in with the admin account created above:

- Username: `admin`
- Password: `Admin1234!`

Useful checks:

```bash
agent-browser --version
agent-browser skills get core --full
agent-browser install
```

If browser automation fails, rerun `agent-browser install` and inspect the agent-browser output before changing app code.

## Upload Screenshot Artifacts

AWS CLI is installed so cloud agents can upload browser screenshots and other artifacts when AWS credentials and an artifact S3 destination are available.

Create screenshots with `agent-browser`, then upload them with `aws s3 cp`:

```bash
mkdir -p /tmp/artifacts
agent-browser screenshot /tmp/artifacts/mattermost-playbooks.png
aws sts get-caller-identity
aws s3 cp /tmp/artifacts/mattermost-playbooks.png <artifact-s3-uri>/mattermost-playbooks.png
```

Do not print AWS credentials or secret environment variables. If `aws sts get-caller-identity` fails, stop and report the missing AWS configuration instead of attempting to work around credentials.

## Gotchas

- Webapp dependencies install with `--ignore-scripts --legacy-peer-deps` (see `Makefile`); the install script uses `make webapp/node_modules` to match local development.
- Go unit tests expect Postgres to be reachable; start the `mm-postgres` container before `make test`.
- The Mattermost Enterprise `master` image runs as `linux/amd64` even on arm64 cloud agents; always pass `--platform linux/amd64` when starting Mattermost.
- For E2E tests, set `CYPRESS_developerMode=true` when invoking Cypress to avoid unexpected server config changes.

## Troubleshooting

- If Docker is unavailable, inspect `/tmp/docker-service-start.log` and `/tmp/dockerd.log`.
- If browser automation fails, run `agent-browser install` to refresh browser assets.
- If artifact uploads fail, run `aws sts get-caller-identity` and verify the target S3 URI before retrying.
- If the plugin upload fails, confirm `MM_PLUGINSETTINGS_ENABLEUPLOADS=true` and the admin credentials are exported.
- If Mattermost is unhealthy, run `docker logs mattermost` and `docker logs mm-postgres`.
- To reset the local Mattermost stack, run `docker rm -f mattermost mm-postgres` and remove `/tmp/mattermost` or `mm-postgres-data` if persisted data is not needed.
