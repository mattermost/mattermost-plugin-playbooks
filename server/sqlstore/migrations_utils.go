package sqlstore

import (
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
)

// 'IF NOT EXISTS' syntax is not supported in Postgres 9.4, so we need
// this workaround to make the migration idempotent
var createPGIndex = func(indexName, tableName, columns string) string {
	return fmt.Sprintf(`
		DO
		$$
		BEGIN
			IF to_regclass('%s') IS NULL THEN
				CREATE INDEX %s ON %s (%s);
			END IF;
		END
		$$;
	`, indexName, indexName, tableName, columns)
}

var addColumnToPGTable = func(e sqlx.Ext, tableName, columnName, columnType string) error {
	_, err := e.Exec(fmt.Sprintf(`
		DO
		$$
		BEGIN
			ALTER TABLE %s ADD %s %s;
		EXCEPTION
			WHEN duplicate_column THEN
				RAISE NOTICE 'Ignoring ALTER TABLE statement. Column "%s" already exists in table "%s".';
		END
		$$;
	`, tableName, columnName, columnType, columnName, tableName))

	return err
}

var addColumnToMySQLTable = func(e sqlx.Ext, dbName, tableName, columnName, columnType string) error {
	var result int
	err := e.QueryRowx(
		"SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
		dbName,
		tableName,
		columnName,
	).Scan(&result)

	// Only alter the table if we don't find the column
	if err == sql.ErrNoRows {
		_, err = e.Exec(fmt.Sprintf("ALTER TABLE %s ADD %s %s", tableName, columnName, columnType))
	}

	return err
}
