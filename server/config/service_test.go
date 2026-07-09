// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func newServiceWithAPI(api *plugintest.API) *ServiceImpl {
	return &ServiceImpl{api: pluginapi.NewClient(api, nil)}
}

func TestReconcileLegacyConfigKeys(t *testing.T) {
	t.Parallel()

	t.Run("keeps the console value when both keys are present", func(t *testing.T) {
		t.Parallel()
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		api.On("GetPluginConfig").Return(map[string]any{
			"BotUserID":                "bot1",
			"enableincrementalupdates": true,
			"EnableIncrementalUpdates": false,
		})

		var saved map[string]any
		api.On("SavePluginConfig", mock.Anything).Run(func(args mock.Arguments) {
			saved = args.Get(0).(map[string]any)
		}).Return((*model.AppError)(nil))

		require.NoError(t, newServiceWithAPI(api).reconcileLegacyConfigKeys())

		assert.Equal(t, true, saved["enableincrementalupdates"])
		assert.NotContains(t, saved, "EnableIncrementalUpdates")
		assert.Equal(t, "bot1", saved["BotUserID"])
	})

	t.Run("folds a legacy-only value into its canonical key", func(t *testing.T) {
		t.Parallel()
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		api.On("GetPluginConfig").Return(map[string]any{
			"EnableIncrementalUpdates": true,
		})

		var saved map[string]any
		api.On("SavePluginConfig", mock.Anything).Run(func(args mock.Arguments) {
			saved = args.Get(0).(map[string]any)
		}).Return((*model.AppError)(nil))

		require.NoError(t, newServiceWithAPI(api).reconcileLegacyConfigKeys())

		assert.Equal(t, true, saved["enableincrementalupdates"])
		assert.NotContains(t, saved, "EnableIncrementalUpdates")
	})

	t.Run("resolves every aliased setting at once", func(t *testing.T) {
		t.Parallel()
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		api.On("GetPluginConfig").Return(map[string]any{
			"EnableTeamsTabApp":        true,
			"teamsTabAppTenantIDs":     "tenant-a",
			"TeamsTabAppTenantIDs":     "stale-tenant",
			"EnableIncrementalUpdates": false,
		})

		var saved map[string]any
		api.On("SavePluginConfig", mock.Anything).Run(func(args mock.Arguments) {
			saved = args.Get(0).(map[string]any)
		}).Return((*model.AppError)(nil))

		require.NoError(t, newServiceWithAPI(api).reconcileLegacyConfigKeys())

		assert.Equal(t, true, saved["enableTeamsTabApp"])
		assert.NotContains(t, saved, "EnableTeamsTabApp")
		assert.Equal(t, "tenant-a", saved["teamsTabAppTenantIDs"])
		assert.NotContains(t, saved, "TeamsTabAppTenantIDs")
		assert.Equal(t, false, saved["enableincrementalupdates"])
		assert.NotContains(t, saved, "EnableIncrementalUpdates")
	})

	t.Run("does not persist when there is nothing to reconcile", func(t *testing.T) {
		t.Parallel()
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		api.On("GetPluginConfig").Return(map[string]any{
			"BotUserID":                "bot1",
			"enableincrementalupdates": true,
		})

		require.NoError(t, newServiceWithAPI(api).reconcileLegacyConfigKeys())

		api.AssertNotCalled(t, "SavePluginConfig", mock.Anything)
	})
}
