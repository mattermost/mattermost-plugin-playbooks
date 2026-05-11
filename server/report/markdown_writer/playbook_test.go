// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// fixturePlaybook builds a minimal-but-complete PlaybookRenderContext that
// exercises every section the playbook-report markdown writer emits.
func fixturePlaybook() report.PlaybookRenderContext {
	return report.PlaybookRenderContext{
		Playbook: report.RenderPlaybook{
			ID:          "pb1",
			Title:       "Playbook Alpha",
			Description: "An example playbook.",
			Public:      true,
			TeamID:      "team1",
		},
		Members: []report.RenderPlaybookMember{
			{UserID: "u1", DisplayName: "Alice Admin", Roles: []string{"playbook_admin"}},
		},
		ChecklistTemplates: []report.RenderChecklist{
			{
				Title: "Initial response",
				Items: []report.RenderChecklistItem{
					{Title: "Page on-call"},
					{Title: "Open war room"},
					{Title: "Postmortem doc", Description: "Write it up.", Command: "/postmortem create"},
				},
			},
		},
		StatusUpdateConfig: report.RenderStatusUpdateConfig{
			Enabled:  true,
			Template: "Current status: ...",
			Cadence:  "Every 30 minutes",
		},
		RetrospectiveConfig: report.RenderRetrospectiveConfig{
			Enabled:         true,
			Template:        "## Retro template",
			ReminderCadence: "On finish",
			Metrics: []report.RenderMetric{
				{ID: "m1", Title: "Time to detect", Type: "duration", Target: 5 * 60 * 1000},
			},
		},
		BroadcastChannels: []report.RenderChannel{
			{ChannelID: "c1", Name: "alerts", DisplayName: "Alerts"},
		},
		WebhooksOnCreation: []report.RenderWebhook{
			{HostMasked: "https://hooks.slack.com/****"},
		},
		WebhooksOnStatus: []report.RenderWebhook{
			{HostMasked: "https://hooks.example.com/****"},
		},
		SignalKeywords: []string{"outage", "incident"},
		Resolvers: report.ResolverTable{
			Users: map[string]report.RenderUser{
				"u1": {UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
			},
			Channels: map[string]report.RenderChannel{
				"c1": {ChannelID: "c1", Name: "alerts", DisplayName: "Alerts"},
			},
		},
		GeneratedAtMillis: 1_700_000_900_000,
	}
}

const expectedPlaybookMarkdown = "# Playbook Alpha\n" +
	"\n" +
	"**Type**: Public  ·  **Generated**: 2023-11-14 22:28\n" +
	"\n" +
	"## Description\n" +
	"\n" +
	"An example playbook.\n" +
	"\n" +
	"## Members\n" +
	"\n" +
	"- @alice (playbook_admin)\n" +
	"\n" +
	"## Checklist Templates\n" +
	"\n" +
	"### Initial response (0/3 · 0%)\n" +
	"\n" +
	"- [ ] Page on-call\n" +
	"- [ ] Open war room\n" +
	"- [ ] Postmortem doc\n" +
	"\n" +
	"    Write it up.\n" +
	"    `/postmortem create`\n" +
	"\n" +
	"## Status Updates\n" +
	"\n" +
	"**Enabled**: Enabled  ·  **Cadence**: Every 30 minutes\n" +
	"\n" +
	"Current status: ...\n" +
	"\n" +
	"## Retrospective\n" +
	"\n" +
	"**Enabled**: Enabled  ·  **Cadence**: On finish\n" +
	"\n" +
	"## Retro template\n" +
	"\n" +
	"**Metrics**\n" +
	"\n" +
	"- **Time to detect** (duration, target 5m 0s)\n" +
	"\n" +
	"## Automations\n" +
	"\n" +
	"### Broadcast Channels\n" +
	"\n" +
	"- ~alerts\n" +
	"\n" +
	"### Webhooks on Run Creation\n" +
	"\n" +
	"- `https://hooks.slack.com/****`\n" +
	"\n" +
	"### Webhooks on Status Update\n" +
	"\n" +
	"- `https://hooks.example.com/****`\n" +
	"\n" +
	"### Signal Keywords\n" +
	"\n" +
	"- `outage`\n" +
	"- `incident`\n" +
	"\n" +
	"---\n" +
	"\n" +
	"_Generated 2023-11-14 22:28 UTC._\n"

func TestRenderPlaybookMarkdown_GoldenFullFixture(t *testing.T) {
	got := string(RenderPlaybookMarkdown(fixturePlaybook()))
	if got != expectedPlaybookMarkdown {
		t.Fatalf("output mismatch.\n--- got ---\n%s\n--- want ---\n%s\n", got, expectedPlaybookMarkdown)
	}
}

func TestRenderPlaybookMarkdown_WebhookFullPreferredOverMasked(t *testing.T) {
	pc := fixturePlaybook()
	pc.WebhooksOnCreation = []report.RenderWebhook{
		{HostMasked: "https://hooks.slack.com/****", Full: "https://hooks.slack.com/services/SECRET"},
	}

	got := string(RenderPlaybookMarkdown(pc))

	require.Contains(t, got, "https://hooks.slack.com/services/SECRET",
		"expected Full webhook URL when present")
	require.NotContains(t, got, "https://hooks.slack.com/****",
		"masked form must be suppressed when Full is present")
}

func TestRenderPlaybookMarkdown_ResolverDenyPaths(t *testing.T) {
	pc := fixturePlaybook()
	pc.Resolvers = report.ResolverTable{
		Users:    map[string]report.RenderUser{},
		Channels: map[string]report.RenderChannel{},
	}

	got := string(RenderPlaybookMarkdown(pc))

	require.Contains(t, got, "- @_redacted_user_ (playbook_admin)",
		"member should render with redacted user sentinel")
}

func TestRenderPlaybookMarkdown_EmptySectionsEmitItalicPlaceholders(t *testing.T) {
	pc := report.PlaybookRenderContext{
		Playbook: report.RenderPlaybook{
			Title:  "Empty Playbook",
			Public: false,
		},
		Resolvers:         report.ResolverTable{Users: map[string]report.RenderUser{}},
		GeneratedAtMillis: 1_700_000_900_000,
	}

	got := string(RenderPlaybookMarkdown(pc))

	require.Contains(t, got, "_No description._")
	require.Contains(t, got, "_No members._")
	require.Contains(t, got, "_No checklist templates._")
	require.Contains(t, got, "_No status update configuration._")
	require.Contains(t, got, "_No retrospective configuration._")
	require.Contains(t, got, "_No automations._")
	require.Contains(t, got, "**Type**: Private")
}

func TestRenderPlaybookMarkdown_PrivateVisibility(t *testing.T) {
	pc := fixturePlaybook()
	pc.Playbook.Public = false

	got := string(RenderPlaybookMarkdown(pc))

	require.True(t, strings.Contains(got, "**Type**: Private"),
		"expected Private type indicator")
	require.False(t, strings.Contains(got, "**Type**: Public"),
		"Public should not appear when Public=false")
}
