package pluginkvstore

import (
	"encoding/json"
	"testing"

	"github.com/golang/mock/gomock"
	mock_plugin "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks/serverpluginapi"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestAddToIndex(t *testing.T) {
	t.Run("Update empty headers", func(t *testing.T) {
		mockCtrl := gomock.NewController(t)
		pluginAPI := mock_plugin.NewMockAPI(mockCtrl)

		// Make KVGet return an empty value to simulate that the key is not set yet
		pluginAPI.EXPECT().
			KVGet(PlaybookIndexKey).
			Return([]byte{}, nil).
			Times(1)

		playbookID := "playbook_id"
		// Verify that KVSet is called to set the first value, proving that
		// SetAtomicWithRetries was called inside addToIndex
		value, err := json.Marshal(playbookIndex{PlaybookIDs: []string{playbookID}})
		require.NoError(t, err)
		kvSetOptions := model.PluginKVSetOptions{
			Atomic:          true,
			OldValue:        nil,
			ExpireInSeconds: 0,
		}
		pluginAPI.EXPECT().
			KVSetWithOptions(PlaybookIndexKey, value, kvSetOptions).
			Return(true, nil).
			Times(1)

		// Set the wrapped plugin API client with the mocked underlying plugin API
		// and assign it to the store
		pluginAPIClient := pluginapi.NewClient(pluginAPI)
		s := &PlaybookStore{
			kvAPI: &pluginAPIClient.KV,
		}

		err = s.addToIndex(playbookID)
		require.NoError(t, err)
	})
}

func TestRemoveFromIndex(t *testing.T) {
	t.Run("Remove nonexistent index", func(t *testing.T) {
		mockCtrl := gomock.NewController(t)
		pluginAPI := mock_plugin.NewMockAPI(mockCtrl)

		// Make KVGet return an empty value to simulate that the key is not set yet
		pluginAPI.EXPECT().
			KVGet(PlaybookIndexKey).
			Return([]byte{}, nil).
			Times(1)

		// Verify that KVSet is called with nil, an empty index, proving that
		// SetAtomicWithRetries was called inside removeFromIndex
		kvSetOptions := model.PluginKVSetOptions{
			Atomic:          true,
			OldValue:        nil,
			ExpireInSeconds: 0,
		}
		pluginAPI.EXPECT().
			KVSetWithOptions(PlaybookIndexKey, nil, kvSetOptions).
			Return(true, nil).
			Times(1)

		// Set the wrapped plugin API client with the mocked underlying plugin API
		// and assign it to the store
		pluginAPIClient := pluginapi.NewClient(pluginAPI)
		s := &PlaybookStore{
			kvAPI: &pluginAPIClient.KV,
		}

		err := s.removeFromIndex("nonexistent_ID")
		require.NoError(t, err)
	})
}
