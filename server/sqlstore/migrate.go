package sqlstore

import (
	"github.com/blang/semver"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func (sqlStore *SQLStore) Migrate(pluginAPIClient *pluginapi.Client, currentSchemaVersion semver.Version) error {
	for _, migration := range migrations {
		if !currentSchemaVersion.EQ(migration.fromVersion) {
			continue
		}

		if err := migration.migrationFunc(sqlStore); err != nil {
			return errors.Wrapf(err, "error executing migration from version %s to version %s", migration.fromVersion.String(), migration.toVersion.String())
		}

		currentSchemaVersion = migration.toVersion
		if err := SetCurrentVersion(pluginAPIClient, currentSchemaVersion); err != nil {
			return errors.Wrapf(err, "migration succeeded, but failed to set the current version to %s. Database is now in an inconsistent state", currentSchemaVersion.String())
		}

		// TODO: Remove when all customers are in 0.1.0
		if currentSchemaVersion.EQ(semver.MustParse("0.1.0")) {
			if err := DataMigration(sqlStore, &pluginAPIClient.KV); err != nil {
				return errors.Wrapf(err, "failed to migrate the data from the KV store to the SQL database")
			}
		}
	}

	return nil
}
