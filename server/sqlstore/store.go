package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-server/v5/model"
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
func (sqlStore *SQLStore) getBuilder(q sqlx.Queryer, dest interface{}, b builder) error {
	sqlString, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	sqlString = sqlStore.db.Rebind(sqlString)

	return sqlx.Get(q, dest, sqlString, args...)
}

// selectBuilder queries for one or more rows, building the sql, and writing the result into dest.
//
// Use this to simplify querying for multiple rows (and possibly columns). Dest may be a slice of
// a simple, or a slice of a struct with fields to be populated from the returned columns.
func (sqlStore *SQLStore) selectBuilder(q sqlx.Queryer, dest interface{}, b builder) error {
	sqlString, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	sqlString = sqlStore.db.Rebind(sqlString)

	return sqlx.Select(q, dest, sqlString, args...)
}

// execer is an interface describing a resource that can execute write queries.
//
// It allows the use of *sqlx.Db and *sqlx.Tx.
type execer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
	DriverName() string
}

// exec executes the given query using positional arguments, automatically rebinding for the db.
func (sqlStore *SQLStore) exec(e execer, sqlString string, args ...interface{}) (sql.Result, error) {
	sqlString = sqlStore.db.Rebind(sqlString)
	return e.Exec(sqlString, args...)
}

// exec executes the given query, building the necessary sql.
func (sqlStore *SQLStore) execBuilder(e execer, b builder) error {
	sqlString, args, err := b.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	// The linter was complaining that we never used the sql.Result. So doing this for now.
	// Return the (sql.Result, error) if we ever end up using it.
	_, err = sqlStore.exec(e, sqlString, args...)

	return err
}

func (sqlStore *SQLStore) doesTableExist(tableName string) (bool, error) {
	var query sq.SelectBuilder

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)

	switch sqlStore.db.DriverName() {
	case model.DATABASE_DRIVER_MYSQL:
		query = builder.
			Select("count(0)").
			From("information_Schema.TABLES").
			Where(sq.Eq{
				"TABLE_SCHEMA": "DATABASE()",
				"TABLE_NAME":   tableName,
			})
	case model.DATABASE_DRIVER_POSTGRES:
		query = builder.PlaceholderFormat(sq.Dollar).
			Select("count(relname)").
			From("pg_class").
			Where(sq.Eq{"relname": tableName})
	default:
		return false, errors.Errorf("driver %s not supported", sqlStore.db.DriverName())
	}

	var count int
	if err := sqlStore.getBuilder(sqlStore.db, &count, query); err != nil {
		return false, errors.Wrap(err, "failed to check if table exists")
	}

	return count > 0, nil
}
