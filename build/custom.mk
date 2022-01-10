# Include custom targets and environment variables here
GO_BUILD_FLAGS += -ldflags "-X main.rudderDataplaneURL=$(MM_RUDDER_DATAPLANE_URL) -X main.rudderWriteKey=$(MM_RUDDER_WRITE_KEY)"

## Generate mocks.
mocks:
ifneq ($(HAS_SERVER),)
	mockgen -destination server/config/mocks/mock_service.go github.com/mattermost/mattermost-plugin-playbooks/server/config Service
	mockgen -destination server/bot/mocks/mock_logger.go github.com/mattermost/mattermost-plugin-playbooks/server/bot Logger
	mockgen -destination server/bot/mocks/mock_poster.go github.com/mattermost/mattermost-plugin-playbooks/server/bot Poster
	mockgen -destination server/app/mocks/mock_playbook_run_service.go github.com/mattermost/mattermost-plugin-playbooks/server/app PlaybookRunService
	mockgen -destination server/app/mocks/mock_playbook_run_store.go github.com/mattermost/mattermost-plugin-playbooks/server/app PlaybookRunStore
	mockgen -destination server/app/mocks/mock_job_once_scheduler.go github.com/mattermost/mattermost-plugin-playbooks/server/app JobOnceScheduler
	mockgen -destination server/app/mocks/mock_playbook_service.go github.com/mattermost/mattermost-plugin-playbooks/server/app PlaybookService
	mockgen -destination server/app/mocks/mock_playbook_store.go github.com/mattermost/mattermost-plugin-playbooks/server/app PlaybookStore
	mockgen -destination server/app/mocks/mock_keywords_ignorer.go github.com/mattermost/mattermost-plugin-playbooks/server/app KeywordsThreadIgnorer
	mockgen -destination server/sqlstore/mocks/mock_kvapi.go github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore KVAPI
	mockgen -destination server/sqlstore/mocks/mock_storeapi.go github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore StoreAPI
	mockgen -destination server/sqlstore/mocks/mock_configurationapi.go github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore ConfigurationAPI
	mockgen -destination server/app/mocks/mock_user_info_store.go github.com/mattermost/mattermost-plugin-playbooks/server/app UserInfoStore
endif

## Runs the redocly server.
.PHONY: docs-server
docs-server:
	npx @redocly/openapi-cli@1.0.0-beta.3 preview-docs server/api/api.yaml

## Re-generate tests-e2e/db-setup/mattermost.sql from the Postgres image expected to be running
## in the developer's Docker environment.
.PHONY: tests-e2e/db-setup/mattermost.sql
tests-e2e/db-setup/mattermost.sql:
	docker exec mattermost-postgres pg_dump \
		--username=mmuser \
		--clean \
		--if-exists \
		--exclude-table ir_incident \
		--exclude-table ir_playbook \
		--exclude-table ir_playbookmember \
		--exclude-table ir_statusposts \
		--exclude-table ir_system \
		--exclude-table ir_timelineevent \
		--exclude-table ir_userinfo \
		--exclude-table ir_viewedchannel \
		mattermost_test > tests-e2e/db-setup/mattermost.sql
