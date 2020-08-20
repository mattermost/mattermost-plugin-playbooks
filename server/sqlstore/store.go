package sqlstore

import (
	"database/sql"

	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/pkg/errors"
)

type SQLStore struct {
	log bot.Logger
	db  *sqlx.DB
}

// New constructs a new instance of SQLStore.
func New(pluginAPI PluginAPIClient, log bot.Logger) (*SQLStore, error) {
	var db *sqlx.DB

	origDB, err := pluginAPI.Store.GetMasterDB()
	if err != nil {
		return nil, err
	}
	db = sqlx.NewDb(origDB, pluginAPI.Store.DriverName())

	// TODO: Leave the default mapper as strings.ToLower?

	return &SQLStore{
		log,
		db,
	}, nil
}

// builder is an interface describing a resource that can construct SQL and arguments.
//
// It exists to allow consuming any squirrel.*Builder type.
type builder interface {
	ToSql() (string, []interface{}, error)
}

// get queries for a single row, building the sql, and writing the result into dest.
//
// Use this to simplify querying for a single row or column. Dest may be a pointer to a simple
// type, or a struct with fields to be populated from the returned columns.
func (sqlStore *SQLStore) getBuilder(dest interface{}, b builder) error {
	sqlString, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	sqlString = sqlStore.db.Rebind(sqlString)

	err = sqlx.Get(sqlStore.db, dest, sqlString, args...)
	if err != nil {
		return err
	}

	return nil
}

// selectBuilder queries for one or more rows, building the sql, and writing the result into dest.
//
// Use this to simplify querying for multiple rows (and possibly columns). Dest may be a slice of
// a simple, or a slice of a struct with fields to be populated from the returned columns.
func (sqlStore *SQLStore) selectBuilder(dest interface{}, b builder) error {
	sqlString, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	sqlString = sqlStore.db.Rebind(sqlString)

	err = sqlx.Select(sqlStore.db, dest, sqlString, args...)
	if err != nil {
		return err
	}

	return nil
}

// exec executes the given query using positional arguments, automatically rebinding for the db.
func (sqlStore *SQLStore) exec(sqlString string, args ...interface{}) (sql.Result, error) {
	sqlString = sqlStore.db.Rebind(sqlString)
	return sqlStore.db.Exec(sqlString, args...)
}

// exec executes the given query, building the necessary sql.
func (sqlStore *SQLStore) execBuilder(b builder) error {
	sqlString, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	// The linter was complaining that we never used the sql.Result. So doing this for now.
	// Return the (sql.Result, error) if we ever end up using it.
	_, err = sqlStore.exec(sqlString, args...)

	return err
}
