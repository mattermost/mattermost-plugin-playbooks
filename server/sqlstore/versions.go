package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
)

func LatestVersion() semver.Version {
	return migrations[len(migrations)-1].toVersion
}

func (sqlStore *SQLStore) GetCurrentVersion() (semver.Version, error) {
	tableExists, err := sqlStore.doesTableExist("IR_System")
	if err != nil {
		return semver.Version{}, errors.Wrap(err, "could not check if table IR_System exists")
	}

	if !tableExists {
		return semver.MustParse("0.0.0"), nil
	}

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if sqlStore.db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	versionSelect := builder.
		Select("SValue").
		From("IR_System").
		Where(sq.Eq{"SKey": "DatabaseVersion"})

	var versionString string
	err = sqlStore.getBuilder(sqlStore.db, &versionString, versionSelect)

	if err == sql.ErrNoRows {
		return semver.MustParse("0.0.0"), nil
	}

	if err != nil {
		return semver.Version{}, errors.Wrapf(err, "failed retrieving the DatabaseVersion key from the IR_System table")
	}

	currentSchemaVersion, err := semver.Parse(versionString)
	if err != nil {
		return semver.Version{}, errors.Wrapf(err, "unable to parse current schema version")
	}

	return currentSchemaVersion, nil
}

func (sqlStore *SQLStore) SetCurrentVersion(tx *sqlx.Tx, currentVersion semver.Version) error {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if sqlStore.db.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	versionUpdate := builder.
		Update("IR_System").
		Set("SValue", currentVersion.String()).
		Where(sq.Eq{"SKey": "DatabaseVersion"})

	fmt.Println(versionUpdate.ToSql())

	sqlString, args, err := versionUpdate.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build sql")
	}

	result, err := sqlStore.exec(tx, sqlString, args...)
	if err != nil {
		return errors.Wrap(err, "failed to execute the Update query")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		return nil
	}

	versionInsert := builder.
		Insert("IR_System").
		Columns("SKey", "SValue").
		Values("DatabaseVersion", currentVersion.String())

	if err := sqlStore.execBuilder(tx, versionInsert); err != nil {
		return errors.Wrap(err, "failed to execute the Insert query")
	}

	return nil
}
