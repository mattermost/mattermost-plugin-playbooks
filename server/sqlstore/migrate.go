package sqlstore

import (
	"database/sql"

	"github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/pkg/errors"
)

func Migrate(db *sql.DB, currentSchemaVersion semver.Version, pluginAPIClient *pluginapi.Client, builder squirrel.StatementBuilderType) error {
	for _, migration := range migrations {
		if !currentSchemaVersion.EQ(migration.fromVersion) {
			continue
		}

		if err := migration.migrationFunc(db); err != nil {
			return errors.Wrapf(err, "error executing migration from version %s to version %s", migration.fromVersion.String(), migration.toVersion.String())
		}

		currentSchemaVersion = migration.toVersion
		if err := SetCurrentVersion(pluginAPIClient, currentSchemaVersion); err != nil {
			return errors.Wrapf(err, "migration succeeded, but failed to set the current version to %s. Database is now in an inconsistent state", currentSchemaVersion.String())
		}

		// TODO: Remove when all customers are in 0.1.0
		if currentSchemaVersion.EQ(semver.MustParse("0.1.0")) {
			if err := DataMigration(&pluginAPIClient.KV, builder, db); err != nil {
				return errors.Wrapf(err, "failed to migrate the data from the KV store to the SQL database")
			}
		}
	}

	return nil
}
