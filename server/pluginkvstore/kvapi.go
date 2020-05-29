package pluginkvstore

import pluginapi "github.com/mattermost/mattermost-plugin-api"

const keyVersionPrefix = "v1_"

// KVAPI is the key value store interface for the pluginkv stores.
// It is implemented by mattermost-plugin-api/Client.KV, or by the mock KVAPI.
type KVAPI interface {
	Set(key string, value interface{}, options ...pluginapi.KVSetOption) (bool, error)
	Get(key string, out interface{}) error
	DeleteAll() error
}
