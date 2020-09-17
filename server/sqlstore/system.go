package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

// getSystemValue queries the IR_System table for the given key
func (sqlStore *SQLStore) getSystemValue(q queryer, key string) (string, error) {
	var value string

	err := sqlStore.getBuilder(q, &value,
		sq.Select("SValue").
			From("IR_System").
			Where(sq.Eq{"SKey": key}),
	)
	if err == sql.ErrNoRows {
		return "", nil
	} else if err != nil {
		return "", errors.Wrapf(err, "failed to query system key %s", key)
	}

	return value, nil
}

// setSystemValue updates the IR_System table for the given key.
func (sqlStore *SQLStore) setSystemValue(e execer, key, value string) error {
	result, err := sqlStore.execBuilder(e,
		sq.Update("IR_System").
			Set("SValue", value).
			Where(sq.Eq{"SKey": key}),
	)
	if err != nil {
		return errors.Wrapf(err, "failed to update system key %s", key)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		return nil
	}

	_, err = sqlStore.execBuilder(e,
		sq.Insert("IR_System").
			Columns("SKey", "SValue").
			Values(key, value),
	)
	if err != nil {
		return errors.Wrapf(err, "failed to insert system key %s", key)
	}

	return nil
}

func (sqlStore *SQLStore) isUnaccentAvailable() (bool, error) {
	if sqlStore.cachedUnaccentCheck != nil {
		return *sqlStore.cachedUnaccentCheck, nil
	}

	if sqlStore.db.DriverName() != model.DATABASE_DRIVER_POSTGRES {
		sqlStore.cachedUnaccentCheck = bToP(false)

		return false, nil
	}

	var unaccentExists bool
	err := sqlStore.getBuilder(sqlStore.db, &unaccentExists,
		sq.Expr("SELECT EXISTS(SELECT * FROM pg_proc WHERE proname = 'unaccent')"))

	if err != nil {
		return false, err
	}

	sqlStore.cachedUnaccentCheck = &unaccentExists

	return unaccentExists, err
}

// bToP stands for boolean To Pointer
func bToP(b bool) *bool {
	return &b
}
