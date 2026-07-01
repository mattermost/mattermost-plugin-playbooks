// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bot

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func newPosterForTest(t *testing.T) (*Bot, *plugintest.API) {
	t.Helper()
	api := &plugintest.API{}
	t.Cleanup(func() { api.AssertExpectations(t) })
	return &Bot{pluginAPI: pluginapi.NewClient(api, nil)}, api
}

// captureBroadcast registers a PublishWebSocketEvent expectation and returns a pointer that
// receives the broadcast the method was called with.
func captureBroadcast(api *plugintest.API, event string) **model.WebsocketBroadcast {
	captured := new(*model.WebsocketBroadcast)
	api.On("PublishWebSocketEvent", event, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			*captured = args.Get(2).(*model.WebsocketBroadcast)
		}).Once()
	return captured
}

func TestPublishWebsocketEventBroadcastScope(t *testing.T) {
	const (
		event     = "playbook_run_updated"
		channelID = "channel-id"
		userID    = "user-id"
		teamID    = "team-id"
	)
	payload := map[string]string{"foo": "bar"}

	for _, tc := range []struct {
		name     string
		call     func(b *Bot)
		assertWB func(t *testing.T, wb *model.WebsocketBroadcast)
	}{
		{
			name: "ToChannel is best-effort",
			call: func(b *Bot) { b.PublishWebsocketEventToChannel(event, payload, channelID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, channelID, wb.ChannelId)
				assert.False(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToChannelReliable sets ReliableClusterSend",
			call: func(b *Bot) { b.PublishWebsocketEventToChannelReliable(event, payload, channelID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, channelID, wb.ChannelId)
				assert.True(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToUser is best-effort",
			call: func(b *Bot) { b.PublishWebsocketEventToUser(event, payload, userID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, userID, wb.UserId)
				assert.False(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToUserReliable sets ReliableClusterSend",
			call: func(b *Bot) { b.PublishWebsocketEventToUserReliable(event, payload, userID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, userID, wb.UserId)
				assert.True(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToTeam is best-effort",
			call: func(b *Bot) { b.PublishWebsocketEventToTeam(event, payload, teamID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, teamID, wb.TeamId)
				assert.False(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "ToTeamReliable sets ReliableClusterSend",
			call: func(b *Bot) { b.PublishWebsocketEventToTeamReliable(event, payload, teamID) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.Equal(t, teamID, wb.TeamId)
				assert.True(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "Global is best-effort",
			call: func(b *Bot) { b.PublishWebsocketEventGlobal(event, payload) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.False(t, wb.ReliableClusterSend)
			},
		},
		{
			name: "GlobalReliable sets ReliableClusterSend",
			call: func(b *Bot) { b.PublishWebsocketEventGlobalReliable(event, payload) },
			assertWB: func(t *testing.T, wb *model.WebsocketBroadcast) {
				assert.True(t, wb.ReliableClusterSend)
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, api := newPosterForTest(t)
			captured := captureBroadcast(api, event)

			tc.call(b)

			require.NotNil(t, *captured)
			tc.assertWB(t, *captured)
		})
	}
}

func TestPublishWebsocketEventPayloadMarshalled(t *testing.T) {
	// All publish methods funnel payload marshalling through the same helper, so cover both a
	// reliable and a best-effort entry point to guard the shared path against future refactors.
	for _, tc := range []struct {
		name string
		call func(b *Bot, event string, payload interface{})
	}{
		{"reliable", func(b *Bot, event string, payload interface{}) {
			b.PublishWebsocketEventToChannelReliable(event, payload, "channel-id")
		}},
		{"best-effort", func(b *Bot, event string, payload interface{}) {
			b.PublishWebsocketEventToChannel(event, payload, "channel-id")
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, api := newPosterForTest(t)
			payload := map[string]string{"hello": "world"}

			var gotPayload map[string]interface{}
			api.On("PublishWebSocketEvent", "evt", mock.Anything, mock.Anything).
				Run(func(args mock.Arguments) {
					gotPayload = args.Get(1).(map[string]interface{})
				}).Once()

			tc.call(b, "evt", payload)

			raw, ok := gotPayload["payload"].(string)
			require.True(t, ok, "payload should be JSON-encoded under the \"payload\" key")
			var decoded map[string]string
			require.NoError(t, json.Unmarshal([]byte(raw), &decoded))
			assert.Equal(t, payload, decoded)
		})
	}
}
