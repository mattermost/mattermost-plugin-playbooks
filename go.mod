module github.com/mattermost/mattermost-plugin-playbooks

go 1.14

require (
	github.com/Masterminds/squirrel v1.5.0
	github.com/blang/semver v3.5.1+incompatible
	github.com/fatih/color v1.13.0 // indirect
	github.com/fsnotify/fsnotify v1.5.1 // indirect
	github.com/go-sql-driver/mysql v1.6.0
	github.com/golang/mock v1.4.4
	github.com/google/uuid v1.3.0 // indirect
	github.com/gorilla/mux v1.8.0
	github.com/hashicorp/go-hclog v1.0.0 // indirect
	github.com/hashicorp/go-plugin v1.4.3 // indirect
	github.com/hashicorp/yamux v0.0.0-20210826001029-26ff87cf9493 // indirect
	github.com/jmoiron/sqlx v1.3.4
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/klauspost/cpuid/v2 v2.0.9 // indirect
	github.com/kr/pretty v0.3.0 // indirect
	github.com/lib/pq v1.10.3
	github.com/mattermost/go-i18n v1.11.1-0.20211013152124-5c415071e404 // indirect
	github.com/mattermost/logr/v2 v2.0.15 // indirect
	github.com/mattermost/mattermost-plugin-api v0.0.21-0.20210825201013-18b0ff361b38
	github.com/mattermost/mattermost-plugin-playbooks/client v0.6.0
	github.com/mattermost/mattermost-server/v6 v6.0.0-20210825182941-ddfa6e2436d6
	github.com/mattn/go-colorable v0.1.11 // indirect
	github.com/minio/minio-go/v7 v7.0.14 // indirect
	github.com/onsi/gomega v1.16.0 // indirect
	github.com/pelletier/go-toml v1.9.4 // indirect
	github.com/pkg/errors v0.9.1
	github.com/rogpeppe/go-internal v1.8.0 // indirect
	github.com/rudderlabs/analytics-go v3.3.1+incompatible
	github.com/sirupsen/logrus v1.8.1
	github.com/stretchr/testify v1.7.0
	github.com/tidwall/gjson v1.9.2 // indirect
	github.com/writeas/go-strip-markdown v2.0.1+incompatible
	github.com/yuin/goldmark v1.4.1 // indirect
	golang.org/x/crypto v0.0.0-20210921155107-089bfa567519 // indirect
	golang.org/x/net v0.0.0-20211006190231-62292e806868 // indirect
	golang.org/x/oauth2 v0.0.0-20210628180205-a41e5a781914 // indirect
	golang.org/x/sys v0.0.0-20211006225509-1a26e0398eed // indirect
	golang.org/x/text v0.3.7 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/genproto v0.0.0-20211005153810-c76a74d43a8e // indirect
	google.golang.org/grpc v1.41.0 // indirect
	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c // indirect
	gopkg.in/ini.v1 v1.63.2 // indirect
)

replace github.com/mattermost/mattermost-plugin-playbooks/client => ./client
