module github.com/mattermost/mattermost-plugin-playbooks

go 1.14

require (
	github.com/BurntSushi/toml v0.4.1 // indirect
	github.com/Masterminds/squirrel v1.5.1
	github.com/blang/semver v3.5.1+incompatible
	github.com/go-sql-driver/mysql v1.6.0
	github.com/golang/mock v1.6.0
	github.com/gorilla/mux v1.8.0
	github.com/jmoiron/sqlx v1.3.4
	github.com/lib/pq v1.10.4
	github.com/mattermost/mattermost-plugin-api v0.0.22-0.20211207232216-3faec618d311
	github.com/mattermost/mattermost-plugin-playbooks/client v0.7.0
	github.com/mattermost/mattermost-server/v6 v6.0.0-20211207185652-92e80bd4ed31
	github.com/pkg/errors v0.9.1
	github.com/rudderlabs/analytics-go v3.3.1+incompatible
	github.com/sirupsen/logrus v1.8.1
	github.com/stretchr/testify v1.7.0
	github.com/writeas/go-strip-markdown v2.0.1+incompatible
)

replace github.com/mattermost/mattermost-plugin-playbooks/client => ./client

replace github.com/HdrHistogram/hdrhistogram-go => github.com/codahale/hdrhistogram v1.1.2

replace github.com/golang/mock v1.6.0 => github.com/golang/mock v1.4.4
