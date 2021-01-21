// This file is automatically generated. Do not modify it manually.

package main

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

var manifest *model.Manifest

const manifestStr = `
{
  "id": "com.mattermost.plugin-incident-management",
  "name": "Incident Management",
  "description": "This plugin allows users to coordinate and manage incidents within Mattermost.",
  "homepage_url": "https://github.com/mattermost/mattermost-plugin-incident-management/",
  "support_url": "https://github.com/mattermost/mattermost-plugin-incident-management/issues",
  "release_notes_url": "https://github.com/mattermost/mattermost-plugin-incident-management/releases/tag/v1.2.0",
  "icon_path": "assets/incident_plugin_icon.svg",
  "version": "1.2.0+9fcd0b92",
  "min_server_version": "5.28.0",
  "server": {
    "executables": {
      "linux-amd64": "server/dist/plugin-linux-amd64",
      "darwin-amd64": "server/dist/plugin-darwin-amd64",
      "windows-amd64": "server/dist/plugin-windows-amd64.exe"
    },
    "executable": ""
  },
  "webapp": {
    "bundle_path": "webapp/dist/main.js"
  },
  "settings_schema": {
    "header": "",
    "footer": "",
    "settings": []
  }
}
`

func init() {
	manifest = model.ManifestFromJson(strings.NewReader(manifestStr))
}
