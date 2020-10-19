module github.com/mattermost/mattermost-plugin-incident-response/client

go 1.15

require (
	github.com/google/go-querystring v1.0.0
	github.com/mattermost/mattermost-plugin-incident-response v1.0.0
	github.com/mattermost/mattermost-server/v5 v5.28.0
	github.com/pkg/errors v0.9.1
	github.com/stretchr/testify v1.6.1
)

replace github.com/mattermost/mattermost-plugin-incident-response => ../
