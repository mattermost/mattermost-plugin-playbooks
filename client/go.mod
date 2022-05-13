module github.com/mattermost/mattermost-plugin-playbooks/client

go 1.15

replace github.com/mattermost/mattermost-server/v6 => github.com/mattermost/mattermost-server/v6 v6.0.0-20220512052723-ea98f9f4a9dc

require (
	github.com/google/go-querystring v1.1.0
	github.com/mattermost/mattermost-server/v6 v6.0.0-20220512052723-ea98f9f4a9dc
	github.com/pkg/errors v0.9.1
	github.com/stretchr/testify v1.7.1
	golang.org/x/oauth2 v0.0.0-20211104180415-d3ed0bb246c8
	gopkg.in/guregu/null.v4 v4.0.0
)
