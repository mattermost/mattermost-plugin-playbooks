// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"io"

	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func configurePluginLogrus(logger *logrus.Logger, client *pluginapi.Client) {
	configureLogrus(logger, pluginapi.NewLogrusHook(client.Log))
}

func configureLogrus(logger *logrus.Logger, hook logrus.Hook) {
	logger.AddHook(hook)
	logger.SetOutput(io.Discard)
	logger.SetReportCaller(true)
	logger.SetLevel(logrus.TraceLevel)
}
