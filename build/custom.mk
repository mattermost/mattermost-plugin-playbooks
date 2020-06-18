# Include custom targets and environment variables here
GO_BUILD_FLAGS := $(GO_BUILD_FLAGS) -ldflags "-X main.rudderDataplaneURL=$(MM_RUDDER_DATAPLANE_URL) -X main.rudderWriteKey=$(MM_RUDDER_WRITE_KEY)"

## Generate mocks.
mocks:
ifneq ($(HAS_SERVER),)
	go install github.com/golang/mock/mockgen
	mockgen -destination server/config/mocks/mock_service.go github.com/mattermost/mattermost-plugin-incident-response/server/config Service
	mockgen -destination server/bot/mocks/mock_logger.go github.com/mattermost/mattermost-plugin-incident-response/server/bot Logger
	mockgen -destination server/bot/mocks/mock_poster.go github.com/mattermost/mattermost-plugin-incident-response/server/bot Poster
	mockgen -destination server/incident/mocks/mock_service.go github.com/mattermost/mattermost-plugin-incident-response/server/incident Service
	mockgen -destination server/incident/mocks/mock_store.go github.com/mattermost/mattermost-plugin-incident-response/server/incident Store
	mockgen -destination server/pluginkvstore/mocks/mock_kvapi.go github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore KVAPI
	mockgen -destination server/pluginkvstore/mocks/mock_storeapi.go github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore StoreAPI
endif
