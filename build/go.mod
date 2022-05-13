module github.com/mattermost/mattermost-plugin-starter-template/build

go 1.12

replace github.com/mattermost/mattermost-server/v6 => github.com/mattermost/mattermost-server/v6 v6.0.0-20220512052723-ea98f9f4a9dc

require (
	github.com/mattermost/mattermost-server/v6 v6.0.0-20220512052723-ea98f9f4a9dc
	github.com/mholt/archiver/v3 v3.5.1
	github.com/pkg/errors v0.9.1
	github.com/stretchr/testify v1.7.1
	gopkg.in/src-d/go-git.v4 v4.13.1
	sigs.k8s.io/yaml v1.2.0
)
