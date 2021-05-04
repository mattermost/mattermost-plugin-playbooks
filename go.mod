module github.com/mattermost/mattermost-plugin-incident-collaboration

go 1.14

require (
	github.com/Masterminds/squirrel v1.5.0
	github.com/blang/semver v3.5.1+incompatible
	github.com/golang/mock v1.4.4
	github.com/gorilla/mux v1.8.0
	github.com/jmoiron/sqlx v1.3.1
	github.com/mattermost/mattermost-plugin-api v0.0.16-0.20210430153609-48123d2963a7
	github.com/mattermost/mattermost-plugin-incident-collaboration/client v0.3.1
	github.com/mattermost/mattermost-server/v5 v5.3.2-0.20210430151419-e43861a6358f
	github.com/pkg/errors v0.9.1
	github.com/rudderlabs/analytics-go v3.3.1+incompatible
	github.com/sirupsen/logrus v1.8.1
	github.com/stretchr/testify v1.7.0
	github.com/writeas/go-strip-markdown v2.0.1+incompatible
)

replace github.com/mattermost/mattermost-plugin-incident-collaboration/client => ./client
