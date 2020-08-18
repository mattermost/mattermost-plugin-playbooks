package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/pkg/errors"
)

func LatestVersion() semver.Version {
	return migrations[len(migrations)-1].toVersion
}

func GetCurrentVersion(builder sq.StatementBuilderType, db *sql.DB) (semver.Version, error) {
	queryBuilder := builder.
		Select("value").
		From("system").
		Where(sq.Eq{"key": "DatabaseVersion"})

	query, args, err := queryBuilder.ToSql()
	if err != nil {
		return semver.Version{}, errors.Wrapf(err, "failed converting the query to SQL")
	}

	var versionString string
	err = db.QueryRow(query, args...).Scan(&versionString)

	// Default to 0.0.0 if no version is defined
	if err == sql.ErrNoRows {
		return semver.MustParse("0.0.0"), nil
	}

	if err != nil {
		return semver.Version{}, errors.Wrapf(err, "failed scanning the query results")
	}

	currentSchemaVersion, err := semver.Parse(versionString)
	if err != nil {
		return semver.Version{}, errors.Wrapf(err, "unable to parse current schema version")
	}

	return currentSchemaVersion, nil
}

func SetCurrentVersion(builder sq.StatementBuilderType, db *sql.DB, currentVersion semver.Version) error {
	queryBuilder := builder.
		Update("system").
		Set("Value", currentVersion.String()).
		Where(sq.Eq{"key": "DatabaseVersion"})

	query, args, err := queryBuilder.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed converting the query to SQL")
	}

	_, err = db.Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed executing the query")
	}

	return nil
}
