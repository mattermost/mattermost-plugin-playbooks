package sqlstore

import (
	"database/sql"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	mock_bot "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-incident-response/server/sqlstore/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/stretchr/testify/require"
)

var driverNames = []string{model.DATABASE_DRIVER_POSTGRES, model.DATABASE_DRIVER_MYSQL}

func setupTestDB(t *testing.T, driverName string) *sqlx.DB {
	t.Helper()

	sqlSettings := storetest.MakeSqlSettings(driverName)

	origDB, err := sql.Open(*sqlSettings.DriverName, *sqlSettings.DataSource)
	require.NoError(t, err)

	db := sqlx.NewDb(origDB, driverName)
	if driverName == model.DATABASE_DRIVER_MYSQL {
		db.MapperFunc(func(s string) string { return s })
	}

	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
		storetest.CleanupSqlSettings(sqlSettings)
	})

	return db
}

func setupSQLStore(t *testing.T, db *sqlx.DB) (PluginAPIClient, bot.Logger, *SQLStore) {
	mockCtrl := gomock.NewController(t)

	logger := mock_bot.NewMockLogger(mockCtrl)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	driverName := db.DriverName()
	configAPI.EXPECT().
		GetConfig().
		Return(&model.Config{
			SqlSettings: model.SqlSettings{DriverName: &driverName},
		}).
		Times(1)

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if driverName == model.DATABASE_DRIVER_POSTGRES {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	sqlStore := &SQLStore{
		logger,
		db,
		builder,
	}

	kvAPI.EXPECT().
		Get("v2_playbookindex", gomock.Any()).
		SetArg(1, oldPlaybookIndex{}).
		Times(1)

	kvAPI.EXPECT().
		Get("v2_all_headers", gomock.Any()).
		SetArg(1, map[string]oldHeader{}).
		Times(1)

	currentSchemaVersion, err := sqlStore.GetCurrentVersion()
	require.NoError(t, err)

	if currentSchemaVersion.LT(LatestVersion()) {
		err = sqlStore.Migrate(pluginAPIClient, currentSchemaVersion)
		require.NoError(t, err)
	}

	return pluginAPIClient, logger, sqlStore
}
