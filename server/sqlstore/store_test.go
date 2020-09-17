package sqlstore

import (
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestIsUnaccentAvailable(t *testing.T) {
	t.Run("Returns false in MySQL", func(t *testing.T) {
		db := setupTestDB(t, model.DATABASE_DRIVER_MYSQL)
		_, _, sqlStore := setupSQLStore(t, db)

		unaccentExists, err := sqlStore.isUnaccentAvailable()
		require.NoError(t, err)
		require.False(t, unaccentExists)
	})

	t.Run("Returns true if it exists", func(t *testing.T) {
		db := setupTestDB(t, model.DATABASE_DRIVER_POSTGRES)
		_, _, sqlStore := setupSQLStore(t, db)

		var rawUnaccentExists bool
		err := sqlStore.getBuilder(sqlStore.db, &rawUnaccentExists,
			sq.Expr("SELECT EXISTS(SELECT * FROM pg_proc WHERE proname = 'unaccent')"))
		require.NoError(t, err)

		require.True(t, rawUnaccentExists)

		unaccentExists, err := sqlStore.isUnaccentAvailable()
		require.NoError(t, err)
		require.True(t, unaccentExists)
	})

	t.Run("Returns false if it does not exist", func(t *testing.T) {
		db := setupTestDB(t, model.DATABASE_DRIVER_POSTGRES)
		_, _, sqlStore := setupSQLStore(t, db)

		_, err := sqlStore.execBuilder(sqlStore.db, sq.Expr("DROP EXTENSION IF EXISTS unaccent"))
		require.NoError(t, err)

		unaccentExists, err := sqlStore.isUnaccentAvailable()
		require.NoError(t, err)
		require.False(t, unaccentExists)
	})

	t.Run("Returns cached value if available", func(t *testing.T) {
		db := setupTestDB(t, model.DATABASE_DRIVER_POSTGRES)
		_, _, sqlStore := setupSQLStore(t, db)

		sqlStore.cachedUnaccentCheck = bToP(true)
		unaccentExists, err := sqlStore.isUnaccentAvailable()
		require.NoError(t, err)
		require.True(t, unaccentExists)

		sqlStore.cachedUnaccentCheck = bToP(false)
		unaccentExists, err = sqlStore.isUnaccentAvailable()
		require.NoError(t, err)
		require.False(t, unaccentExists)
	})
}
