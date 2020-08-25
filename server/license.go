package main

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/sirupsen/logrus"
)

func isLicensed(config *model.Config, license *model.License) bool {
	if license != nil && license.Features != nil && license.Features.FutureFeatures != nil && *license.Features.FutureFeatures {
		logrus.Trace("Found valid Mattermost Enterprise E20 License")
		return true
	}

	if config != nil && config.ServiceSettings.EnableTesting != nil && *config.ServiceSettings.EnableTesting && config.ServiceSettings.EnableDeveloper != nil && *config.ServiceSettings.EnableDeveloper {
		logrus.Trace("Found EnableTesting and EnableDeveloper")
		return true
	}

	return false
}
