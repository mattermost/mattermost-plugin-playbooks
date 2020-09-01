package sqlstore

import (
	"database/sql"

	"github.com/blang/semver"
	"github.com/pkg/errors"
)

func (sqlStore *SQLStore) Migrate(pluginAPI PluginAPIClient, originalSchemaVersion semver.Version) error {
	currentSchemaVersion := originalSchemaVersion
	for _, migration := range migrations {
		if !currentSchemaVersion.EQ(migration.fromVersion) {
			continue
		}

		tx, err := sqlStore.db.Beginx()
		if err != nil {
			return errors.Wrap(err, "could not begin transaction")
		}
		defer func() {
			cerr := tx.Rollback()
			if err == nil && cerr != sql.ErrTxDone {
				err = cerr
			}
		}()

		if err := migration.migrationFunc(tx); err != nil {
			return errors.Wrapf(err, "error executing migration from version %s to version %s", migration.fromVersion.String(), migration.toVersion.String())
		}

		if err := sqlStore.SetCurrentVersion(tx, migration.toVersion); err != nil {
			return errors.Wrapf(err, "migration succeeded, but failed to set the current version to %s. Database is now in an inconsistent state", migration.toVersion.String())
		}

		// TODO: Remove when all customers are in 0.1.0
		if migration.toVersion.EQ(semver.MustParse("0.1.0")) {
			if err := DataMigration(sqlStore, tx, pluginAPI.KV); err != nil {
				return errors.Wrap(err, "failed to migrate the data from the KV store to the SQL database")
			}
		}

		if err := tx.Commit(); err != nil {
			return errors.Wrap(err, "could not commit transaction")
		}

		currentSchemaVersion = migration.toVersion
	}

	return nil
}
