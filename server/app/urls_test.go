// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetPlaybookDetailsURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/playbooks/playbookTestId",
		getPlaybookDetailsURL("http://mattermost.com", "playbookTestId"),
	)
}

func TestGetPlaybooksNewURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/playbooks/new",
		getPlaybooksNewURL("http://mattermost.com"),
	)
}

func TestGetPlaybooksURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/playbooks",
		getPlaybooksURL("http://mattermost.com"),
	)
}

func TestGetPlaybookDetailsRelativeURL(t *testing.T) {
	require.Equal(t,
		"/playbooks/playbooks/testPlaybookId",
		GetPlaybookDetailsRelativeURL("testPlaybookId"),
	)
}

func TestGetRunDetailsRelativeURL(t *testing.T) {
	require.Equal(t,
		"/playbooks/runs/testPlaybookRunId",
		GetRunDetailsRelativeURL("testPlaybookRunId"),
	)
}

func TestGetRunDetailsURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/runs/testPlaybookRunId",
		getRunDetailsURL("http://mattermost.com", "testPlaybookRunId"),
	)
}

func TestGetRunRetrospectiveURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/runs/testPlaybookRunId/retrospective",
		getRunRetrospectiveURL("http://mattermost.com", "testPlaybookRunId"),
	)
}

func TestGetChannelRelativeURL(t *testing.T) {
	require.Equal(t,
		"/myteam/channels/channel-name",
		getChannelRelativeURL("myteam", "channel-name"),
	)
}

func TestGetRelativeURLForChannel(t *testing.T) {
	// public/private: /<team>/channels/<name>
	require.Equal(t,
		"/myteam/channels/my-channel",
		getRelativeURLForChannel("myteam", &model.Channel{Name: "my-channel", Type: model.ChannelTypeOpen}),
	)
	require.Equal(t,
		"/myteam/channels/my-private",
		getRelativeURLForChannel("myteam", &model.Channel{Name: "my-private", Type: model.ChannelTypePrivate}),
	)
	// GM: /<team>/messages/<channel.Name>
	require.Equal(t,
		"/myteam/messages/user1__user2__user3",
		getRelativeURLForChannel("myteam", &model.Channel{Id: "gmId", Name: "user1__user2__user3", Type: model.ChannelTypeGroup}),
	)
	// DM: /<team>/messages/<channel.Id>  (ID, not name, for stability)
	require.Equal(t,
		"/myteam/messages/channelId123",
		getRelativeURLForChannel("myteam", &model.Channel{Id: "channelId123", Name: "user1__user2", Type: model.ChannelTypeDirect}),
	)
}

func TestGetURLForChannel(t *testing.T) {
	// public: absolute version
	require.Equal(t,
		"http://mattermost.com/myteam/channels/my-channel",
		getURLForChannel("http://mattermost.com", "myteam", &model.Channel{Name: "my-channel", Type: model.ChannelTypeOpen}),
	)
	// GM: /messages/<channel.Name>
	require.Equal(t,
		"http://mattermost.com/myteam/messages/user1__user2__user3",
		getURLForChannel("http://mattermost.com", "myteam", &model.Channel{Id: "gmId", Name: "user1__user2__user3", Type: model.ChannelTypeGroup}),
	)
	// DM: /messages/<channel.Id>
	require.Equal(t,
		"http://mattermost.com/myteam/messages/channelId123",
		getURLForChannel("http://mattermost.com", "myteam", &model.Channel{Id: "channelId123", Name: "user1__user2", Type: model.ChannelTypeDirect}),
	)
}
