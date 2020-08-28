package sqlstore

import (
	"database/sql"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// StoreAPI is the interface exposing the underlying database, provided by pluginapi
// It is implemented by mattermost-plugin-api/Client.Store, or by the mock StoreAPI.
type StoreAPI interface {
	GetMasterDB() (*sql.DB, error)
	DriverName() string
}

// PluginAPIClient is the struct combining the interfaces defined above, which is everything
// from pluginapi that the store currently uses.
type PluginAPIClient struct {
	Store StoreAPI
}

// NewClient receives a pluginapi.Client and returns the PluginAPIClient, which is what the
// store will use to access pluginapi.Client.
func NewClient(api *pluginapi.Client) PluginAPIClient {
	return PluginAPIClient{
		Store: api.Store,
	}
}
