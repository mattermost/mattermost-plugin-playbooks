package main

import (
	incident "github.com/mattermost/mattermost-plugin-incident-response/server/plugin"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

func main() {
	plugin.ClientMain(&incident.Plugin{})
}
