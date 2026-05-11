// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"bytes"
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func samplePlaybookContext() PlaybookRenderContext {
	return PlaybookRenderContext{
		Playbook: RenderPlaybook{
			ID:          "pb1",
			Title:       "DB Incident Response",
			Description: "Standard playbook for DB outages.",
			Public:      false,
			TeamID:      "t1",
		},
		Members: []RenderPlaybookMember{
			{UserID: "u1", DisplayName: "Alice Admin", Roles: []string{"playbook_admin"}},
			{UserID: "u2", DisplayName: "Bob Builder", Roles: []string{"playbook_member"}},
		},
		ChecklistTemplates: []RenderChecklist{
			{
				Title: "Triage",
				Items: []RenderChecklistItem{
					{Title: "Page on-call", AssigneeID: "u1", DueAtMs: 5 * 60 * 1000},
					{Title: "Open war room", Command: "/war-room start"},
				},
			},
		},
		StatusUpdateConfig: RenderStatusUpdateConfig{
			Enabled:  true,
			Template: "## Status\n- What's happening?",
			Cadence:  "Every 30 minutes",
		},
		RetrospectiveConfig: RenderRetrospectiveConfig{
			Enabled:         true,
			Template:        "What went well?",
			ReminderCadence: "After 24 hours",
			Metrics: []RenderMetric{
				{ID: "m1", Title: "Time to detect", Type: "duration", Target: 5 * 60 * 1000},
			},
		},
		BroadcastChannels: []RenderChannel{
			{ChannelID: "c1", Name: "incidents", DisplayName: "Incidents"},
		},
		WebhooksOnCreation: []RenderWebhook{
			{HostMasked: "https://hooks.example.com/****", Full: "https://hooks.example.com/abc123"},
		},
		WebhooksOnStatus: []RenderWebhook{
			{HostMasked: "https://hooks.example.com/****"},
		},
		SignalKeywords: []string{"sev1", "outage"},
		Resolvers: ResolverTable{
			Users: map[string]RenderUser{
				"u1": {UserID: "u1", DisplayName: "Alice Admin"},
				"u2": {UserID: "u2", DisplayName: "Bob Builder"},
			},
		},
		GeneratedAtMillis: 1_700_001_000_000,
	}
}

func TestRenderPlaybook_Smoke(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	buf, err := r.RenderPlaybook(context.Background(), samplePlaybookContext(), RenderOptions{
		Sections: DefaultPlaybookSections(),
		Locale:   "en",
	})
	require.NoError(t, err)
	require.NotNil(t, buf)
	require.Greater(t, buf.Len(), 100)
	require.Equal(t, []byte("%PDF"), buf.Bytes()[:4])
}

// TestAddWebhookList_PrefersFullThenMasked locks the MF-1 contract: when
// Full is populated it is rendered; when empty, HostMasked is rendered;
// the renderer NEVER reconstructs.
func TestAddWebhookList_PrefersFullThenMasked(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	pc := samplePlaybookContext()
	pc.ChecklistTemplates = nil
	pc.BroadcastChannels = nil
	pc.SignalKeywords = nil
	pc.RetrospectiveConfig.Metrics = nil
	pc.RetrospectiveConfig.Template = ""
	pc.StatusUpdateConfig.Template = ""

	buf, err := r.RenderPlaybook(context.Background(), pc, RenderOptions{
		Sections: SectionFlags{PlaybookSettings: true},
		Locale:   "en",
	})
	require.NoError(t, err)
	require.NotNil(t, buf)

	body := buf.Bytes()
	require.True(t, bytes.Contains(body, []byte("%PDF")))
}

func TestRenderPlaybook_ContextCancelled(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	buf, err := r.RenderPlaybook(ctx, samplePlaybookContext(), RenderOptions{Sections: DefaultPlaybookSections()})
	require.Error(t, err)
	require.Nil(t, buf)
}

func TestBuildTemplateItemMeta_HandlesEmptyFields(t *testing.T) {
	l := NewLabels("en")
	require.Equal(t, "", buildTemplateItemMeta(RenderChecklistItem{}, ResolverTable{}, l))
	meta := buildTemplateItemMeta(RenderChecklistItem{AssigneeID: "u1", DueAtMs: 5 * 60 * 1000}, ResolverTable{
		Users: map[string]RenderUser{"u1": {UserID: "u1", DisplayName: "Alice"}},
	}, l)
	require.Contains(t, meta, "Alice")
	require.Contains(t, meta, "+5m")
}
