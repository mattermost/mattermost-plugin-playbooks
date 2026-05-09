// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/require"
)

func TestIsChannelActiveInTeam(t *testing.T) {
	newClient := func(api *plugintest.API) *pluginapi.Client {
		return pluginapi.NewClient(api, &plugintest.Driver{})
	}

	t.Run("empty expectedTeamID passes for any channel team", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:     channelID,
			TeamId: model.NewId(),
		}, (*model.AppError)(nil))

		err := IsChannelActiveInTeam(channelID, "", newClient(api))
		require.NoError(t, err)
	})

	t.Run("DM broadcast channel passes when run has a team", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:     channelID,
			TeamId: "",
		}, (*model.AppError)(nil))

		err := IsChannelActiveInTeam(channelID, model.NewId(), newClient(api))
		require.NoError(t, err)
	})

	t.Run("matching teamID passes", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		teamID := model.NewId()
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:     channelID,
			TeamId: teamID,
		}, (*model.AppError)(nil))

		err := IsChannelActiveInTeam(channelID, teamID, newClient(api))
		require.NoError(t, err)
	})

	t.Run("mismatching teamID returns ErrChannelNotInExpectedTeam", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:     channelID,
			TeamId: model.NewId(),
		}, (*model.AppError)(nil))

		err := IsChannelActiveInTeam(channelID, model.NewId(), newClient(api))
		require.ErrorIs(t, err, ErrChannelNotInExpectedTeam)
	})

	t.Run("deleted channel returns ErrChannelDeleted", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: 123456789,
		}, (*model.AppError)(nil))

		err := IsChannelActiveInTeam(channelID, "", newClient(api))
		require.ErrorIs(t, err, ErrChannelDeleted)
	})

	t.Run("channel not found returns ErrChannelNotFound", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(
			(*model.Channel)(nil),
			&model.AppError{Message: "channel not found"},
		)

		err := IsChannelActiveInTeam(channelID, "", newClient(api))
		require.ErrorIs(t, err, ErrChannelNotFound)
	})
}
