package sqlstore_test

import (
	"database/sql"
	"testing"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	_ "github.com/proullon/ramsql/driver"
	"github.com/stretchr/testify/require"
)

func TestDatabase(t *testing.T) {
	t.Run("master db singleton", func(t *testing.T) {
		db, err := sql.Open("ramsql", "TestDatabase-master-db")
		require.NoError(t, err)
		defer db.Close()

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName:                  model.NewString("ramsql"),
				DataSource:                  model.NewString("TestDatabase-master-db"),
				ConnMaxLifetimeMilliseconds: model.NewInt(2),
			},
		}

		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		api.On("GetUnsanitizedConfig").Return(config)

		database := sqlstore.NewDatabase(sqlstore.NewClient(pluginapi.NewClient(api)))

		db1, err := database.GetMasterDB()
		require.NoError(t, err)
		require.NotNil(t, db1)

		db2, err := database.GetMasterDB()
		require.NoError(t, err)
		require.NotNil(t, db2)

		require.Same(t, db1, db2)
		require.NoError(t, database.Close())
	})

	t.Run("master db", func(t *testing.T) {
		db, err := sql.Open("ramsql", "TestDatabase-master-db")
		require.NoError(t, err)
		defer db.Close()

		_, err = db.Exec("CREATE TABLE test (id INT);")
		require.NoError(t, err)
		_, err = db.Exec("INSERT INTO test (id) VALUES (2);")
		require.NoError(t, err)

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName:                  model.NewString("ramsql"),
				DataSource:                  model.NewString("TestDatabase-master-db"),
				ConnMaxLifetimeMilliseconds: model.NewInt(2),
			},
		}

		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		database := sqlstore.NewDatabase(sqlstore.NewClient(pluginapi.NewClient(api)))

		api.On("GetUnsanitizedConfig").Return(config)
		masterDB, err := database.GetMasterDB()
		require.NoError(t, err)
		require.NotNil(t, masterDB)

		var id int
		err = masterDB.QueryRow("SELECT id FROM test").Scan(&id)
		require.NoError(t, err)
		require.Equal(t, 2, id)

		// No replica is set up, should fallback to master
		replicaDB, err := database.GetReplicaDB()
		require.NoError(t, err)
		require.Same(t, replicaDB, masterDB)

		require.NoError(t, database.Close())
	})

	t.Run("replica db singleton", func(t *testing.T) {
		db, err := sql.Open("ramsql", "TestDatabase-master-db")
		require.NoError(t, err)
		defer db.Close()

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName:                  model.NewString("ramsql"),
				DataSource:                  model.NewString("TestDatabase-master-db"),
				DataSourceReplicas:          []string{"TestDatabase-master-db"},
				ConnMaxLifetimeMilliseconds: model.NewInt(2),
			},
		}

		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		api.On("GetUnsanitizedConfig").Return(config)

		database := sqlstore.NewDatabase(sqlstore.NewClient(pluginapi.NewClient(api)))

		db1, err := database.GetReplicaDB()
		require.NoError(t, err)
		require.NotNil(t, db1)

		db2, err := database.GetReplicaDB()
		require.NoError(t, err)
		require.NotNil(t, db2)

		require.Same(t, db1, db2)
		require.NoError(t, database.Close())
	})

	t.Run("replica db", func(t *testing.T) {
		masterDB, err := sql.Open("ramsql", "TestDatabase-replica-db-1")
		require.NoError(t, err)
		defer masterDB.Close()

		_, err = masterDB.Exec("CREATE TABLE test (id INT);")
		require.NoError(t, err)

		replicaDB, err := sql.Open("ramsql", "TestDatabase-replica-db-2")
		require.NoError(t, err)
		defer masterDB.Close()

		_, err = replicaDB.Exec("CREATE TABLE test (id INT);")
		require.NoError(t, err)
		_, err = replicaDB.Exec("INSERT INTO test (id) VALUES (3);")
		require.NoError(t, err)

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName:                  model.NewString("ramsql"),
				DataSource:                  model.NewString("TestDatabase-replica-db-1"),
				DataSourceReplicas:          []string{"TestDatabase-replica-db-2"},
				ConnMaxLifetimeMilliseconds: model.NewInt(2),
			},
		}

		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		database := sqlstore.NewDatabase(sqlstore.NewClient(pluginapi.NewClient(api)))

		api.On("GetUnsanitizedConfig").Return(config)
		databaseMasterDB, err := database.GetMasterDB()
		require.NoError(t, err)
		require.NotNil(t, databaseMasterDB)

		var count int
		err = databaseMasterDB.QueryRow("SELECT COUNT(*) FROM test").Scan(&count)
		require.NoError(t, err)
		require.Equal(t, 0, count)

		databaseReplicaDB, err := database.GetReplicaDB()
		require.NoError(t, err)
		require.NotNil(t, databaseReplicaDB)

		var id int
		err = databaseReplicaDB.QueryRow("SELECT id FROM test").Scan(&id)
		require.NoError(t, err)
		require.Equal(t, 3, id)

		require.NoError(t, database.Close())
	})
}
