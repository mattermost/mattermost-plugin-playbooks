package sqlstore

import (
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/golang/mock/gomock"
	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func TestMigrationIdempotency(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	logger := mock_bot.NewMockLogger(mockCtrl)
	logger.EXPECT().Debugf(gomock.AssignableToTypeOf("string")).Times(2)

	for _, driver := range driverNames {
		builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
		if driver == model.DatabaseDriverPostgres {
			builder = builder.PlaceholderFormat(sq.Dollar)
		}

		t.Run("Run every migration twice", func(t *testing.T) {
			db := setupTestDB(t, driver)
			sqlStore := &SQLStore{
				logger,
				db,
				builder,
			}

			// Make sure we start from scratch
			currentSchemaVersion, err := sqlStore.GetCurrentVersion()
			require.NoError(t, err)
			require.Equal(t, currentSchemaVersion, semver.Version{})

			// Migration to 0.10.0 needs the Channels table to work
			setupChannelsTable(t, db)
			// Migration to 0.21.0 need the Posts table
			setupPostsTable(t, db)

			// Apply each migration twice
			for _, migration := range migrations {
				for i := 0; i < 2; i++ {
					err := sqlStore.migrate(migration)
					require.NoError(t, err)

					currentSchemaVersion, err := sqlStore.GetCurrentVersion()
					require.NoError(t, err)
					require.Equal(t, currentSchemaVersion, migration.toVersion)
				}
			}
		})

		t.Run("Run the whole set of migrations twice", func(t *testing.T) {
			db := setupTestDB(t, driver)
			sqlStore := &SQLStore{
				logger,
				db,
				builder,
			}

			// Make sure we start from scratch
			currentSchemaVersion, err := sqlStore.GetCurrentVersion()
			require.NoError(t, err)
			require.Equal(t, currentSchemaVersion, semver.Version{})

			// Migration to 0.10.0 needs the Channels table to work
			setupChannelsTable(t, db)
			// Migration to 0.21.0 need the Posts table
			setupPostsTable(t, db)

			// Apply the whole set of migrations twice
			for i := 0; i < 2; i++ {
				for _, migration := range migrations {
					err := sqlStore.migrate(migration)
					require.NoError(t, err)

					currentSchemaVersion, err := sqlStore.GetCurrentVersion()
					require.NoError(t, err)
					require.Equal(t, currentSchemaVersion, migration.toVersion)
				}
			}
		})
	}
}

func TestHasConsistentCharset(t *testing.T) {
	t.Run("MySQL", func(t *testing.T) {
		db := setupTestDB(t, model.DatabaseDriverMysql)
		setupPlaybookStore(t, db) // To run the migrations and everything
		badCharsets := []string{}
		err := db.Select(&badCharsets, `
			SELECT tab.table_name
			FROM   information_schema.tables tab
			WHERE  tab.table_schema NOT IN ( 'mysql', 'information_schema',
											 'performance_schema',
											 'sys' )
			AND tab.table_schema = (SELECT DATABASE())
			AND NOT (tab.table_collation = 'utf8mb4_general_ci' OR tab.table_collation = 'utf8mb4_0900_ai_ci')
		`)
		require.Len(t, badCharsets, 0)
		require.NoError(t, err)
	})
}

func TestHasPrimaryKeys(t *testing.T) {
	t.Run("MySQL", func(t *testing.T) {
		db := setupTestDB(t, model.DatabaseDriverMysql)
		setupPlaybookStore(t, db) // To run the migrations and everything
		tablesWithoutPrimaryKeys := []string{}
		err := db.Select(&tablesWithoutPrimaryKeys, `
			SELECT tab.table_name
				   AS tablename
			FROM   information_schema.tables tab
				   LEFT JOIN information_schema.table_constraints tco
						  ON tab.table_schema = tco.table_schema
							 AND tab.table_name = tco.table_name
							 AND tco.constraint_type = 'PRIMARY KEY'
				   LEFT JOIN information_schema.key_column_usage kcu
						  ON tco.constraint_schema = kcu.constraint_schema
							 AND tco.constraint_name = kcu.constraint_name
							 AND tco.table_name = kcu.table_name
			WHERE tab.table_schema = (SELECT DATABASE())
			AND tco.constraint_name is NULL
			GROUP  BY tab.table_schema,
					  tab.table_name,
					  tco.constraint_name
		`)
		require.Len(t, tablesWithoutPrimaryKeys, 0)
		require.NoError(t, err)
	})

	t.Run("Postgres", func(t *testing.T) {
		db := setupTestDB(t, model.DatabaseDriverPostgres)
		setupPlaybookStore(t, db) // To run the migrations and everything
		tablesWithoutPrimaryKeys := []string{}
		err := db.Select(&tablesWithoutPrimaryKeys, `
			SELECT tab.table_name AS pk_name
			FROM   information_schema.tables tab
				   LEFT JOIN information_schema.table_constraints tco
						  ON tco.table_schema = tab.table_schema
							 AND tco.table_name = tab.table_name
							 AND tco.constraint_type = 'PRIMARY KEY'
				   LEFT JOIN information_schema.key_column_usage kcu
						  ON kcu.constraint_name = tco.constraint_name
							 AND kcu.constraint_schema = tco.constraint_schema
							 AND kcu.constraint_name = tco.constraint_name
			WHERE  tab.table_schema NOT IN ( 'pg_catalog', 'information_schema' )
				   AND tab.table_type = 'BASE TABLE'
				   AND tab.table_catalog = (SELECT current_database())
				   AND tco.constraint_name is NULL
			GROUP  BY tab.table_schema,
					  tab.table_name,
					  tco.constraint_name
		`)
		require.Len(t, tablesWithoutPrimaryKeys, 0)
		require.NoError(t, err)
	})

}
