package sqlstore

import (
	"database/sql"
	"sync"
	"time"

	// import sql drivers
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
)

// database exposes the underlying database.
type database struct {
	initialized bool
	api         PluginAPIClient
	mutex       sync.Mutex

	masterDB  *sql.DB
	replicaDB *sql.DB
}

// newDatabase returns a new instance of database.
func newDatabase(api PluginAPIClient) *database {
	return &database{
		api: api,
	}
}

// GetMasterDB gets the master database handle.
//
// Minimum server version: 5.16
func (d *database) GetMasterDB() (*sql.DB, error) {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	if err := d.initialize(); err != nil {
		return nil, err
	}

	return d.masterDB, nil
}

// GetReplicaDB gets the replica database handle.
// Returns masterDB if a replica is not configured.
//
// Minimum server version: 5.16
func (d *database) GetReplicaDB() (*sql.DB, error) {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	if err := d.initialize(); err != nil {
		return nil, err
	}

	if d.replicaDB != nil {
		return d.replicaDB, nil
	}

	return d.masterDB, nil
}

// Close closes any open resourced. This method is idempotent.
func (d *database) Close() error {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	if !d.initialized {
		return nil
	}

	if err := d.masterDB.Close(); err != nil {
		return err
	}

	if d.replicaDB != nil {
		if err := d.replicaDB.Close(); err != nil {
			return err
		}
	}

	return nil
}

// DriverName returns the driver name for the datasource.
func (d *database) DriverName() string {
	return *d.api.Configuration.GetConfig().SqlSettings.DriverName
}

func (d *database) initialize() error {
	if d.initialized {
		return nil
	}

	config := d.api.Configuration.GetUnsanitizedConfig()

	// Set up master db
	db, err := setupConnection(*config.SqlSettings.DataSource, config.SqlSettings)
	if err != nil {
		return errors.Wrap(err, "failed to connect to master db")
	}
	d.masterDB = db

	// Set up replica db
	if len(config.SqlSettings.DataSourceReplicas) > 0 {
		replicaSource := config.SqlSettings.DataSourceReplicas[0]

		db, err := setupConnection(replicaSource, config.SqlSettings)
		if err != nil {
			return errors.Wrap(err, "failed to connect to replica db")
		}
		d.replicaDB = db
	}

	d.initialized = true

	return nil
}

func setupConnection(dataSourceName string, settings model.SqlSettings) (*sql.DB, error) {
	driverName := *settings.DriverName
	db, err := sql.Open(driverName, dataSourceName)
	if err != nil {
		return nil, errors.Wrap(err, "failed to open SQL connection")
	}

	db.SetMaxOpenConns(15)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(time.Duration(*settings.ConnMaxLifetimeMilliseconds) * time.Millisecond)

	return db, nil
}
