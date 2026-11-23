// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer //nolint:staticcheck

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/reporttest"
)

func renderPlaybook(pc report.PlaybookRenderContext) string {
	return string(RenderPlaybookMarkdown(report.BuildPlaybook(pc, reporttest.Options("en", time.UTC))))
}

func TestRenderPlaybookMarkdown_WebhookFullPreferredOverMasked(t *testing.T) {
	pc := reporttest.TypicalPlaybook()
	pc.WebhooksOnStatus = nil
	pc.WebhooksOnCreation = []report.RenderWebhook{
		{HostMasked: "https://hooks.slack.com/****", Full: "https://hooks.slack.com/services/SECRET"},
	}

	got := renderPlaybook(pc)

	require.Contains(t, got, "https://hooks.slack.com/services/SECRET", "expected Full webhook URL when present")
	require.NotContains(t, got, "https://hooks.slack.com/****", "masked form must be suppressed when Full is present")
}

func TestRenderPlaybookMarkdown_ResolverDenyPaths(t *testing.T) {
	pc := reporttest.TypicalPlaybook()
	pc.Resolvers = report.ResolverTable{Users: map[string]report.RenderUser{}}

	got := renderPlaybook(pc)

	require.Contains(t, got, "- Unknown user (Admin, Member)", "member should render as an unknown user")
}
