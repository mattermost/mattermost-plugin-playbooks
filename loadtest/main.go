// Package loadtest implements a load-test Playbooks' controller.
//
// To register the plugin in the load-test tool, this package must be imported:
// as a result of importing it, the init function will automatically register
// the plugin, along with its actions and hooks, into the load-test tool
// controller.
package loadtest

import (
	ltplugins "github.com/mattermost/mattermost-load-test-ng/loadtest/plugins"
)

func init() {
	ltplugins.RegisterPlugin(ltplugins.TypeSimulController, func() ltplugins.Plugin {
		store := &PluginStore{}
		store.Clear()
		return &SimulController{store}
	})

	ltplugins.RegisterPlugin(ltplugins.TypeGenController, func() ltplugins.Plugin {
		store := &PluginStore{}
		store.Clear()
		return &GenController{store}
	})
}
