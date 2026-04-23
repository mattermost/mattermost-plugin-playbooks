// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetPlaybookDetailsURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/playbooks/playbookTestId",
		getPlaybookDetailsURL("http://mattermost.com", "playbookTestId"),
	)

	require.Equal(t,
		"http://mattermost.com/subpath/playbooks/playbooks/playbookTestId",
		getPlaybookDetailsURL("http://mattermost.com/subpath", "playbookTestId"),
	)
}

func TestGetPlaybooksNewURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/playbooks/new",
		getPlaybooksNewURL("http://mattermost.com"),
	)

	require.Equal(t,
		"http://mattermost.com/subpath/playbooks/playbooks/new",
		getPlaybooksNewURL("http://mattermost.com/subpath"),
	)
}

func TestGetPlaybooksURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/playbooks",
		getPlaybooksURL("http://mattermost.com"),
	)

	require.Equal(t,
		"http://mattermost.com/subpath/playbooks/playbooks",
		getPlaybooksURL("http://mattermost.com/subpath"),
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

	require.Equal(t,
		"http://mattermost.com/subpath/playbooks/runs/testPlaybookRunId",
		getRunDetailsURL("http://mattermost.com/subpath", "testPlaybookRunId"),
	)
}

func TestGetRunRetrospectiveURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/playbooks/runs/testPlaybookRunId/retrospective",
		getRunRetrospectiveURL("http://mattermost.com", "testPlaybookRunId"),
	)

	require.Equal(t,
		"http://mattermost.com/subpath/playbooks/runs/testPlaybookRunId/retrospective",
		getRunRetrospectiveURL("http://mattermost.com/subpath", "testPlaybookRunId"),
	)
}

func TestGetChannelURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/subpath/my-team/channels/town-square",
		getChannelURL("http://mattermost.com/subpath", "my-team", "town-square"),
	)
}

func TestGetPostRedirectURL(t *testing.T) {
	require.Equal(t,
		"http://mattermost.com/subpath/_redirect/pl/post-id",
		getPostRedirectURL("http://mattermost.com/subpath", "post-id"),
	)
}

func TestJoinSiteURLFallsBackToRelativePaths(t *testing.T) {
	require.Equal(t,
		"/playbooks/runs/testPlaybookRunId",
		getRunDetailsURL("", "testPlaybookRunId"),
	)

	require.Equal(t,
		"/my-team/channels/town-square",
		getChannelURL("", "my-team", "town-square"),
	)
}
