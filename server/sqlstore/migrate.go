package sqlstore

import (
	"database/sql"

	"github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/pkg/errors"
)

func Migrate(builder squirrel.StatementBuilderType, db *sql.DB, currentSchemaVersion semver.Version) error {
	for _, migration := range migrations {
		if !currentSchemaVersion.EQ(migration.fromVersion) {
			continue
		}

		if err := migration.migrationFunc(db); err != nil {
			return errors.Wrapf(err, "error executing migration from version %s to version %s", migration.fromVersion.String(), migration.toVersion.String())
		}

		currentSchemaVersion = migration.toVersion
		if err := SetCurrentVersion(builder, db, currentSchemaVersion); err != nil {
			return errors.Wrapf(err, "migration succeeded, but failed to set the current version to %s. Database is now in an inconsistent state", currentSchemaVersion.String())
		}
	}

	return nil
}
