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

func TestMdLinkText(t *testing.T) {
	tests := []struct {
		input  string
		expect string
	}{
		{"no special chars", "no special chars"},
		{"[brackets]", `\[brackets\]`},
		{`back\slash`, `back\\slash`},
		{`[combo\]`, `\[combo\\\]`},
		{"nested [a [b] c]", `nested \[a \[b\] c\]`},
		{"", ""},
	}
	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			require.Equal(t, tc.expect, mdLinkText(tc.input))
		})
	}
}

func TestBuildOverdueStatusUpdateMessage(t *testing.T) {
	t.Run("DM channel produces /<team>/messages/<channelId> URL using owner's team", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		svc := &PlaybookRunServiceImpl{pluginAPI: pluginapi.NewClient(api, &plugintest.Driver{})}

		ownerID := model.NewId()
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:          channelID,
			Type:        model.ChannelTypeDirect,
			TeamId:      "",
			DisplayName: "alice, bob",
		}, (*model.AppError)(nil))
		api.On("GetTeamsForUser", ownerID).Return([]*model.Team{
			{Id: model.NewId(), Name: "myteam"},
		}, (*model.AppError)(nil))

		run := &PlaybookRun{ID: model.NewId(), ChannelID: channelID, OwnerUserID: ownerID}
		msg, err := svc.buildOverdueStatusUpdateMessage(run, "alice")
		require.NoError(t, err)
		require.Contains(t, msg, "/myteam/messages/"+channelID)
		require.NotContains(t, msg, "/channels/")
	})

	t.Run("team channel produces team/channel URL", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		svc := &PlaybookRunServiceImpl{pluginAPI: pluginapi.NewClient(api, &plugintest.Driver{})}

		teamID := model.NewId()
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:          channelID,
			TeamId:      teamID,
			Name:        "incident-channel",
			DisplayName: "Incident Channel",
		}, (*model.AppError)(nil))
		api.On("GetTeam", teamID).Return(&model.Team{
			Id:   teamID,
			Name: "myteam",
		}, (*model.AppError)(nil))

		run := &PlaybookRun{ID: model.NewId(), ChannelID: channelID}
		msg, err := svc.buildOverdueStatusUpdateMessage(run, "alice")
		require.NoError(t, err)
		require.Contains(t, msg, "/myteam/channels/incident-channel")
		require.NotContains(t, msg, "/messages/")
	})

	t.Run("display name with brackets is escaped in link text", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		svc := &PlaybookRunServiceImpl{pluginAPI: pluginapi.NewClient(api, &plugintest.Driver{})}

		ownerID := model.NewId()
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:          channelID,
			Type:        model.ChannelTypeDirect,
			TeamId:      "",
			DisplayName: "[alice], [bob]",
		}, (*model.AppError)(nil))
		api.On("GetTeamsForUser", ownerID).Return([]*model.Team{
			{Id: model.NewId(), Name: "myteam"},
		}, (*model.AppError)(nil))

		run := &PlaybookRun{ID: model.NewId(), ChannelID: channelID, OwnerUserID: ownerID}
		msg, err := svc.buildOverdueStatusUpdateMessage(run, "alice")
		require.NoError(t, err)
		require.Contains(t, msg, `\[alice\]`)
		require.NotContains(t, msg, "[alice],")
	})
}
