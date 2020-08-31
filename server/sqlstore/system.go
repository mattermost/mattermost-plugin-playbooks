package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"
)

// getSystemValue queries the IR_System table for the given key
func (sqlStore *SQLStore) getSystemValue(q queryer, key string) (string, error) {
	var value string

	err := sqlStore.getBuilder(q, &value,
		sq.Select("Value").
			From("IR_System").
			Where(sq.Eq{"Key": key}),
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
			Set("Value", value).
			Where(sq.Eq{"Key": key}),
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
			Columns("Key", "Value").
			Values(key, value),
	)
	if err != nil {
		return errors.Wrapf(err, "failed to insert system key %s", key)
	}

	return nil
}
