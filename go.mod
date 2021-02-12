module github.com/mattermost/mattermost-plugin-incident-collaboration

go 1.14

require (
	github.com/Masterminds/squirrel v1.5.0
	github.com/blang/semver v3.5.1+incompatible
	github.com/golang/mock v1.4.3
	github.com/gorilla/mux v1.8.0
	github.com/jmoiron/sqlx v1.2.0
	github.com/mattermost/gorp v2.0.1-0.20200527092429-d62b7b9cadfc+incompatible // indirect
	github.com/mattermost/mattermost-plugin-api v0.0.13-0.20210203140922-cd302a7195a0
	github.com/mattermost/mattermost-server/v5 v5.3.2-0.20210120031517-5a7759f4d63b
	github.com/pkg/errors v0.9.1
	github.com/rudderlabs/analytics-go v3.2.1+incompatible
	github.com/sirupsen/logrus v1.7.0
	github.com/stretchr/testify v1.6.1
	github.com/writeas/go-strip-markdown v2.0.1+incompatible
)

replace github.com/mattermost/mattermost-plugin-incident-collaboration/client => ./client
