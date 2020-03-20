package config

import (
	"sync"

	pluginApi "github.com/mattermost/mattermost-plugin-api"
)

// Config holds access to the plugin's Configuration.
type config struct {
	api *pluginApi.Client

	// configurationLock synchronizes access to the configuration.
	configurationLock sync.RWMutex

	// configuration is the active plugin configuration. Consult getConfiguration and
	// setConfiguration for usage.
	configuration *Configuration

	// configChangeListeners will be notified when the OnConfigurationChange event has been called.
	configChangeListeners map[string]func()
}

// Service is the config/Service interface.
type Service interface {
	// GetConfiguration retrieves the active configuration under lock, making it safe to use
	// concurrently. The active configuration may change underneath the client of this method, but
	// the struct returned by this API call is considered immutable.
	GetConfiguration() *Configuration

	// UpdateConfiguration updates the config. Any parts of the config that are persisted in the plugin's
	// section in the server's config will be saved to the server.
	UpdateConfiguration(f func(*Configuration)) error

	// RegisterConfigChangeListener registers a function that will called when the config might have
	// been changed. Returns an id which can be used to unregister the listener.
	RegisterConfigChangeListener(listener func()) string

	// UnregisterConfigChangeListener unregisters the listener function identified by id.
	UnregisterConfigChangeListener(id string)
}
