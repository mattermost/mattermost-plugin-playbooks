package sqlstore

import (
	"context"
	"embed"
	"fmt"
	"path/filepath"

	"github.com/blang/semver"
	"github.com/pkg/errors"

	"github.com/isacikgoz/morph"
	"github.com/isacikgoz/morph/drivers"
	ms "github.com/isacikgoz/morph/drivers/mysql"
	ps "github.com/isacikgoz/morph/drivers/postgres"
	"github.com/isacikgoz/morph/sources/embedded"
	"github.com/mattermost/mattermost-server/v6/model"
)

//go:embed migrations
var assets embed.FS

// RunMigrations will run the migrations (if any). The caller should hold a cluster mutex if there
// is a danger of this being run on multiple servers at once.
func (sqlStore *SQLStore) RunMigrations() error {
	currentSchemaVersion, err := sqlStore.GetCurrentVersion()
	if err != nil {
		return errors.Wrapf(err, "failed to get the current schema version")
	}

	if err := sqlStore.runMigrationsWithMorph(); err != nil {
		return fmt.Errorf("failed to complete migrations (with morph): %w", err)
	}

	if currentSchemaVersion.LT(LatestVersion()) {
		if err := sqlStore.runMigrationsLegacy(currentSchemaVersion); err != nil {
			return errors.Wrapf(err, "failed to complete migrations")
		}
	}

	return nil
}

func (sqlStore *SQLStore) runMigrationsLegacy(originalSchemaVersion semver.Version) error {
	currentSchemaVersion := originalSchemaVersion
	for _, migration := range migrations {
		if !currentSchemaVersion.EQ(migration.fromVersion) {
			continue
		}

		if err := sqlStore.migrate(migration); err != nil {
			return err
		}

		currentSchemaVersion = migration.toVersion
	}

	return nil
}

func (sqlStore *SQLStore) migrate(migration Migration) (err error) {
	tx, err := sqlStore.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer sqlStore.finalizeTransaction(tx)

	if err := migration.migrationFunc(tx, sqlStore); err != nil {
		return errors.Wrapf(err, "error executing migration from version %s to version %s", migration.fromVersion.String(), migration.toVersion.String())
	}

	if err := sqlStore.SetCurrentVersion(tx, migration.toVersion); err != nil {
		return errors.Wrapf(err, "failed to set the current version to %s", migration.toVersion.String())
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit transaction")
	}
	return nil
}

func (sqlStore *SQLStore) runMigrationsWithMorph() error {
	driverName := sqlStore.db.DriverName()
	assetsList, err := assets.ReadDir(filepath.Join("migrations", driverName))
	if err != nil {
		return err
	}

	assetNamesForDriver := make([]string, len(assetsList))
	for i, entry := range assetsList {
		assetNamesForDriver[i] = entry.Name()
	}

	src, err := embedded.WithInstance(&embedded.AssetSource{
		Names: assetNamesForDriver,
		AssetFunc: func(name string) ([]byte, error) {
			return assets.ReadFile(filepath.Join("migrations", driverName, name))
		},
	})
	if err != nil {
		return err
	}

	config := drivers.Config{
		StatementTimeoutInSecs: 100000,
		MigrationsTable:        "IR_db_migrations",
	}

	var driver drivers.Driver
	switch driverName {
	case model.DatabaseDriverMysql:
		driver, err = ms.WithInstance(sqlStore.db.DB, &ms.Config{
			Config: config,
		})

	case model.DatabaseDriverPostgres:
		driver, err = ps.WithInstance(sqlStore.db.DB, &ps.Config{
			Config: config,
		})
	default:
		err = fmt.Errorf("unsupported database type %s for migration", driverName)
	}
	if err != nil {
		return err
	}

	opts := []morph.EngineOption{
		morph.WithLock("mm-playbooks-lock-key"),
	}
	engine, err := morph.New(context.Background(), driver, src, opts...)
	if err != nil {
		return err
	}
	defer engine.Close()

	if err := engine.ApplyAll(); err != nil {
		return fmt.Errorf("could not apply migrations: %w", err)
	}

	return nil
}
