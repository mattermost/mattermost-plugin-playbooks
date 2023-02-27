GO ?= $(shell command -v go 2> /dev/null)
GO_TEST_FLAGS ?= -race

export GO111MODULE=on

# We need to export GOBIN to allow it to be set
# for processes spawned from the Makefile
export GOBIN ?= $(PWD)/bin

# You can include assets this directory into the bundle. This can be e.g. used to include profile pictures.
ASSETS_DIR ?= assets

## Define the default target (make all)
.PHONY: default
default: all

## Checks the code style, tests, builds and bundles the plugin.
.PHONY: all
all: check-style test


prebuild: ## Run prebuild actions (install dependencies etc.).
	cd webapp; NODE_ENV=development npm install --ignore-scripts --no-save --legacy-peer-deps

## Install go tools
install-go-tools:
	@echo Installing go tools
	$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.51.1
	$(GO) install github.com/golang/mock/mockgen@v1.6.0
	$(GO) install gotest.tools/gotestsum@v1.7.0

## Runs eslint and golangci-lint
.PHONY: check-style
check-style: webapp/node_modules tests-e2e/node_modules server-lint
	@echo Checking for style guide compliance
	cd webapp && npm run lint
	cd webapp && npm run check-types
	cd tests-e2e && npm run check

## Runs golangci-lint
.PHONY: server-lint
server-lint: install-go-tools
	@echo Running golangci-lint
	$(GO) vet ./...
	$(GOBIN)/golangci-lint run ./...


## Fix JS file ESLint issues
.PHONY: fix-style
fix-style: webapp/node_modules tests-e2e/node_modules
	@echo Fixing lint issues to follow style guide
	cd webapp && npm run fix
	cd tests-e2e && npm run fix


## Ensures NPM dependencies are installed without having to run this all the time.
webapp/node_modules: $(wildcard webapp/package.json)
	cd webapp && node skip_integrity_check.js
	cd webapp && $(NPM) install --ignore-scripts --legacy-peer-deps
	touch $@

## Ensures NPM dependencies are installed without having to run this all the time.
tests-e2e/node_modules: $(wildcard tests-e2e/package.json)
	cd tests-e2e && $(NPM) install
	touch $@

.PHONY: build-product
build-product:
	cd webapp && npm run build:product

.PHONY: watch-product
watch-product:
	cd webapp && npm run start:product

## Runs any lints and unit tests defined for the server and webapp, if they exist.
.PHONY: test
test: webapp/node_modules install-go-tools
	$(GOBIN)/gotestsum -- -v ./...
	cd webapp && $(NPM) run test;

## Runs any lints and unit tests defined for the server and webapp, if they exist, optimized
## for a CI environment.
.PHONY: test-ci
test-ci: webapp/node_modules install-go-tools
	$(GOBIN)/gotestsum --format standard-verbose --junitfile report.xml -- ./...
	cd webapp && $(NPM) run test;

## Creates a coverage report for the server code.
.PHONY: coverage
coverage: webapp/node_modules
	$(GO) test $(GO_TEST_FLAGS) -coverprofile=server/coverage.txt ./server/...
	$(GO) tool cover -html=server/coverage.txt

## Extract strings for translation from the source code.
.PHONY: i18n-extract
i18n-extract: i18n-extract-webapp i18n-extract-server

i18n-extract-webapp:
	cd webapp && $(NPM) run extract

i18n-extract-server:
	$(GO) install -modfile=go.tools.mod github.com/mattermost/mattermost-utilities/mmgotool
	mkdir -p server/i18n
	cp assets/i18n/en.json server/i18n/en.json
	cd server && $(GOBIN)/mmgotool i18n extract --portal-dir="" --skip-dynamic
	mv server/i18n/en.json assets/i18n/en.json
	rmdir server/i18n

## Exit on empty translation strings and translation source strings
i18n-check:
	$(GO) install -modfile=go.tools.mod github.com/mattermost/mattermost-utilities/mmgotool
	mkdir -p server/i18n
	cp assets/i18n/en.json server/i18n/en.json
	cd server && $(GOBIN)/mmgotool i18n clean-empty --portal-dir="" --check
	cd server && $(GOBIN)/mmgotool i18n check-empty-src --portal-dir=""
	rmdir server/i18n

## Generate derived types from schema files
.PHONY: graphql
graphql:
	cd webapp && npm run graphql

## Clean removes all build artifacts.
.PHONY: clean
clean:
	rm -fr server/coverage.txt
	rm -fr webapp/junit.xml
	rm -fr webapp/dist
	rm -fr webapp/node_modules


# Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@cat Makefile | grep -v '\.PHONY' |  grep -v '\help:' | grep -B1 -E '^[a-zA-Z0-9_.-]+:.*' | sed -e "s/:.*//" | sed -e "s/^## //" |  grep -v '\-\-' | sed '1!G;h;$$!d' | awk 'NR%2{printf "\033[36m%-30s\033[0m",$$0;next;}1' | sort
