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

	origDb, err := pluginAPI.Store.GetMasterDB()
	if err != nil {
		return nil, err
	}
	db = sqlx.NewDb(origDb, pluginAPI.Store.DriverName())

	// TODO: Leave the default mapper as strings.ToLower?

	return &SQLStore{
		log,
		db,
	}, nil
}

// queryer is an interface describing a resource that can query.
//
// It exactly matches sqlx.Queryer, existing simply to constrain sqlx usage to this file.
type queryer interface {
	sqlx.Queryer
}

// get queries for a single row, writing the result into dest.
//
// Use this to simplify querying for a single row or column. Dest may be a pointer to a simple
// type, or a struct with fields to be populated from the returned columns.
func (sqlStore *SQLStore) get(q sqlx.Queryer, dest interface{}, query string, args ...interface{}) error {
	query = sqlStore.db.Rebind(query)

	return sqlx.Get(q, dest, query, args...)
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
func (sqlStore *SQLStore) getBuilder(q sqlx.Queryer, dest interface{}, b builder) error {
	sql, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	sql = sqlStore.db.Rebind(sql)

	err = sqlx.Get(q, dest, sql, args...)
	if err != nil {
		return err
	}

	return nil
}

// selectBuilder queries for one or more rows, building the sql, and writing the result into dest.
//
// Use this to simplify querying for multiple rows (and possibly columns). Dest may be a slice of
// a simple, or a slice of a struct with fields to be populated from the returned columns.
func (sqlStore *SQLStore) selectBuilder(q sqlx.Queryer, dest interface{}, b builder) error {
	sql, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	sql = sqlStore.db.Rebind(sql)

	err = sqlx.Select(q, dest, sql, args...)
	if err != nil {
		return err
	}

	return nil
}

// execer is an interface describing a resource that can execute write queries.
//
// It allows the use of *sqlx.Db and *sqlx.Tx.
type execer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
	DriverName() string
}

// exec executes the given query using positional arguments, automatically rebinding for the db.
func (sqlStore *SQLStore) exec(e execer, sql string, args ...interface{}) (sql.Result, error) {
	sql = sqlStore.db.Rebind(sql)
	return e.Exec(sql, args...)
}

// exec executes the given query, building the necessary sql.
func (sqlStore *SQLStore) execBuilder(e execer, b builder) (sql.Result, error) {
	sql, args, err := b.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build sql")
	}

	return sqlStore.exec(e, sql, args...)
}
