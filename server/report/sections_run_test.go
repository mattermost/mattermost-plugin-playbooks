// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

// fixedClock returns a deterministic clock for golden-byte friendliness.
func fixedClock(ms int64) func() int64 {
	return func() int64 { return ms }
}

func sampleRunContext() RenderContext {
	return RenderContext{
		Run: RenderRun{
			ID:            "run1",
			Name:          "Incident #42 — DB Outage",
			Summary:       "Brief outage in primary DB cluster.\n\nResolved.",
			Status:        "Finished",
			StartTimeMs:   1_700_000_000_000,
			EndTimeMs:     1_700_000_900_000,
			PlaybookID:    "pb1",
			PlaybookTitle: "DB Incident Response",
		},
		Owner: RenderUser{UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
		StatusUpdates: []RenderStatusUpdate{
			{PostID: "p1", AuthorID: "u1", CreateAt: 1_700_000_100_000, Message: "Investigating."},
			{PostID: "p2", AuthorID: "u1", CreateAt: 1_700_000_500_000, Message: "Failover complete."},
		},
		TimelineEvents: []RenderTimelineEvent{
			{EventType: "incident_created", CreateAt: 1_700_000_000_000, Summary: "Run created", CreatorID: "u1"},
			{EventType: "task_state_modified", CreateAt: 1_700_000_400_000, Summary: "Task closed", Details: "Failover script ran", CreatorID: "u1"},
		},
		Checklists: []RenderChecklist{
			{
				Title: "Initial response",
				Items: []RenderChecklistItem{
					{Title: "Page on-call", State: "Closed", AssigneeID: "u1"},
					{Title: "Open war room", State: "Closed"},
					{Title: "Postmortem doc", State: "", DueAtMs: 1_700_001_000_000},
				},
			},
		},
		Retrospective: RenderRetrospective{
			Body: "## What went well\n- Quick paging",
			Metrics: []RenderMetric{
				{ID: "m1", Title: "Time to detect", Type: "duration", Target: 5 * 60 * 1000, Value: 3 * 60 * 1000, HasValue: true},
				{ID: "m2", Title: "Customer cost", Type: "currency", Target: 100_00, HasValue: false},
			},
		},
		Resolvers: ResolverTable{
			Users: map[string]RenderUser{
				"u1": {UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
			},
		},
		GeneratedAtMillis: 1_700_001_000_000,
	}
}

func TestRenderRun_SmokeFullSections(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	buf, err := r.RenderRun(context.Background(), sampleRunContext(), RenderOptions{
		Sections: DefaultRunSections(),
		Locale:   "en",
		PageSize: PageSizeA4,
		Clock:    fixedClock(1_700_001_000_000),
	})
	require.NoError(t, err)
	require.NotNil(t, buf)
	require.Greater(t, buf.Len(), 100, "expected a non-trivial PDF body")

	require.Equal(t, []byte("%PDF"), buf.Bytes()[:4], "expected PDF magic header")
}

func TestRenderRun_CoverOnly(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	opts := RenderOptions{
		Sections: SectionFlags{Cover: true},
		Locale:   "en",
		Clock:    fixedClock(1_700_001_000_000),
	}
	buf, err := r.RenderRun(context.Background(), sampleRunContext(), opts)
	require.NoError(t, err)
	require.NotNil(t, buf)
}

func TestRenderRun_ContextCancelled(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	buf, err := r.RenderRun(ctx, sampleRunContext(), RenderOptions{Sections: DefaultRunSections()})
	require.Error(t, err)
	require.Nil(t, buf)
}

func TestRenderRun_EmptyChecklistGracefulMessage(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	rc := sampleRunContext()
	rc.Checklists = nil
	rc.TimelineEvents = nil
	rc.StatusUpdates = nil

	buf, err := r.RenderRun(context.Background(), rc, RenderOptions{
		Sections: DefaultRunSections(),
		Locale:   "en",
	})
	require.NoError(t, err)
	require.NotNil(t, buf)
	require.Greater(t, buf.Len(), 100)
}

func TestCountClosed(t *testing.T) {
	items := []RenderChecklistItem{
		{State: "Closed"},
		{State: "Skipped"},
		{State: ""},
		{State: "InProgress"},
	}
	done, total := countClosed(items)
	require.Equal(t, 2, done)
	require.Equal(t, 4, total)
}

func TestFormatMetricValue(t *testing.T) {
	l := NewLabels("en")

	require.Equal(t, "Not set", formatMetricValue(RenderMetric{HasValue: false}, l))
	require.Equal(t, "5m", formatMetricValue(RenderMetric{Type: "duration", Value: 5 * 60 * 1000, HasValue: true}, l))
	require.Equal(t, "12.34", formatMetricValue(RenderMetric{Type: "currency", Value: 1234, HasValue: true}, l))
	require.Equal(t, "42", formatMetricValue(RenderMetric{Type: "integer", Value: 42, HasValue: true}, l))
}

func TestBuildChecklistItemMeta_Unassigned(t *testing.T) {
	l := NewLabels("en")
	meta := buildChecklistItemMeta(RenderChecklistItem{}, ResolverTable{}, l)
	require.Contains(t, meta, "Unassigned")
}

func TestResolveUserDisplay_FallbackToUsername(t *testing.T) {
	l := NewLabels("en")
	rt := ResolverTable{Users: map[string]RenderUser{
		"u1": {UserID: "u1", Username: "alice"},
	}}
	require.Equal(t, "@alice", resolveUserDisplay(rt, "u1", l))
	require.Equal(t, "Unknown user", resolveUserDisplay(rt, "missing", l))
	require.Equal(t, "Unknown user", resolveUserDisplay(rt, "", l))
}
