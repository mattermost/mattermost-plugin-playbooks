package sqlstore

import (
	"github.com/blang/semver"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func LatestVersion() semver.Version {
	return migrations[len(migrations)-1].toVersion
}

func GetCurrentVersion(pluginAPIClient *pluginapi.Client) (semver.Version, error) {
	var versionString string
	if err := pluginAPIClient.KV.Get("DatabaseVersion", &versionString); err != nil {
		return semver.Version{}, errors.Wrapf(err, "failed retrieveing the DatabaseVersion key from the KVStore")
	}

	if versionString == "" {
		return semver.MustParse("0.0.0"), nil
	}

	currentSchemaVersion, err := semver.Parse(versionString)
	if err != nil {
		return semver.Version{}, errors.Wrapf(err, "unable to parse current schema version")
	}

	return currentSchemaVersion, nil
}

func SetCurrentVersion(pluginAPIClient *pluginapi.Client, currentVersion semver.Version) error {
	wasSet, err := pluginAPIClient.KV.Set("DatabaseVersion", currentVersion.String())
	if err != nil {
		return err
	}

	if !wasSet {
		return errors.New("failed to set the current schema version")
	}

	return nil
}
