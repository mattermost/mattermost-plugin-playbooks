// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// fixtureRun builds a minimal-but-complete RenderContext exercising every
// section the run-report markdown writer emits.
func fixtureRun() report.RenderContext {
	return report.RenderContext{
		Run: report.RenderRun{
			ID:            "run1",
			Name:          "Run Alpha",
			Summary:       "Brief outage in primary DB cluster.\n\nResolved.",
			Status:        "InProgress",
			StartTimeMs:   1_700_000_000_000,
			EndTimeMs:     0,
			PlaybookID:    "pb1",
			PlaybookTitle: "PB Alpha",
		},
		Owner: report.RenderUser{UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
		StatusUpdates: []report.RenderStatusUpdate{
			{PostID: "p1", AuthorID: "u1", CreateAt: 1_700_000_100_000, Message: "Investigating."},
		},
		TimelineEvents: []report.RenderTimelineEvent{
			{EventType: "incident_created", CreateAt: 1_700_000_200_000, Summary: "Run created", Details: "by alice", CreatorID: "u1"},
		},
		Checklists: []report.RenderChecklist{
			{
				Title: "Initial response",
				Items: []report.RenderChecklistItem{
					{Title: "Page on-call", State: "closed", AssigneeID: "u1"},
					{Title: "Open war room", State: "skipped"},
					{Title: "Postmortem doc", State: "", DueAtMs: 1_700_001_000_000, Description: "Write it up.", Command: "/postmortem create"},
				},
			},
		},
		Retrospective: report.RenderRetrospective{
			Body: "## What went well\n- Quick paging",
			Metrics: []report.RenderMetric{
				{ID: "m1", Title: "Time to detect", Type: "duration", Target: 5 * 60 * 1000, Value: 3 * 60 * 1000, HasValue: true},
			},
		},
		Transcript: []report.RenderPost{
			{PostID: "tp1", AuthorID: "u1", CreateAt: 1_700_000_300_000, Message: "Looking into it."},
			{PostID: "tp2", AuthorID: "u2", CreateAt: 1_700_000_400_000, Message: "Same here.", RootID: "tp1"},
		},
		Resolvers: report.ResolverTable{
			Users: map[string]report.RenderUser{
				"u1": {UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
				"u2": {UserID: "u2", DisplayName: "Bob Builder", Username: "bob"},
			},
		},
		GeneratedAtMillis: 1_700_000_900_000,
	}
}

const expectedRunMarkdown = "# Run Alpha\n" +
	"\n" +
	"**Status**: In Progress  ·  **Owner**: @alice  ·  **Started**: 2023-11-14 22:13  ·  **Playbook**: PB Alpha\n" +
	"\n" +
	"## Summary\n" +
	"\n" +
	"Brief outage in primary DB cluster.\n" +
	"\n" +
	"Resolved.\n" +
	"\n" +
	"## Timeline\n" +
	"\n" +
	"- **2023-11-14 22:16** · _Run created_ — Run created\n" +
	"  by alice\n" +
	"\n" +
	"## Status Updates\n" +
	"\n" +
	"### @alice — 2023-11-14 22:15\n" +
	"\n" +
	"Investigating.\n" +
	"\n" +
	"## Tasks\n" +
	"\n" +
	"### Initial response (2/3 · 66%)\n" +
	"\n" +
	"- [x] Page on-call\n" +
	"  *(Assignee: @alice)*\n" +
	"- [-] Open war room\n" +
	"  *(Unassigned)*\n" +
	"- [ ] Postmortem doc\n" +
	"  *(Unassigned, Due: 2023-11-14 22:30, Command: `/postmortem create`)*\n" +
	"\n" +
	"    Write it up.\n" +
	"\n" +
	"## Retrospective\n" +
	"\n" +
	"## What went well\n" +
	"- Quick paging\n" +
	"\n" +
	"**Metrics**\n" +
	"\n" +
	"- **Time to detect** — 3m 0s\n" +
	"\n" +
	"## Transcript\n" +
	"\n" +
	"> **@alice** — 2023-11-14 22:18\n" +
	"> Looking into it.\n" +
	"> ↳ **@bob** — 2023-11-14 22:20\n" +
	">   Same here.\n" +
	"\n" +
	"---\n" +
	"\n" +
	"_Generated 2023-11-14 22:28 UTC._\n"

func TestRenderRunMarkdown_GoldenFullFixture(t *testing.T) {
	got := string(RenderRunMarkdown(fixtureRun()))
	if got != expectedRunMarkdown {
		t.Fatalf("output mismatch.\n--- got ---\n%s\n--- want ---\n%s\n", got, expectedRunMarkdown)
	}
}

func TestRenderRunMarkdown_ResolverDenyPaths(t *testing.T) {
	rc := fixtureRun()
	// Wipe resolvers so every lookup goes through the deny path.
	rc.Resolvers = report.ResolverTable{
		Users:    map[string]report.RenderUser{},
		Channels: map[string]report.RenderChannel{},
	}
	// Also clear the Owner's username so the header falls through too.
	rc.Owner = report.RenderUser{UserID: "uX"}

	got := string(RenderRunMarkdown(rc))

	require.Contains(t, got, "**Owner**: @_redacted_user_")
	// Status-update author becomes redacted.
	require.Contains(t, got, "### @_redacted_user_ — ")
	// Task assignee becomes redacted (the Closed item had AssigneeID "u1").
	require.Contains(t, got, "*(Assignee: @_redacted_user_)*")
	// Transcript author becomes redacted (both posts).
	require.Contains(t, got, "> **@_redacted_user_** — ")
	require.Contains(t, got, "> ↳ **@_redacted_user_** — ")
}

func TestRenderRunMarkdown_EmptySectionsEmitItalicPlaceholders(t *testing.T) {
	rc := report.RenderContext{
		Run: report.RenderRun{
			Name:        "Empty Run",
			Status:      "InProgress",
			StartTimeMs: 1_700_000_000_000,
		},
		Owner:             report.RenderUser{Username: "alice"},
		Resolvers:         report.ResolverTable{Users: map[string]report.RenderUser{}},
		GeneratedAtMillis: 1_700_000_900_000,
	}

	got := string(RenderRunMarkdown(rc))

	require.Contains(t, got, "_No summary._")
	require.Contains(t, got, "_No timeline events._")
	require.Contains(t, got, "_No status updates._")
	require.Contains(t, got, "_No tasks._")
	require.Contains(t, got, "_No retrospective._")
	// Empty transcript without a not-member reason set: honest "No transcript."
	require.Contains(t, got, "_No transcript._")
}

func TestRenderRunMarkdown_TruncationFooterWhenHit(t *testing.T) {
	rc := fixtureRun()
	rc.TranscriptTruncation = report.Truncation{Hit: true, Reason: "posts", Posts: 2}

	got := string(RenderRunMarkdown(rc))

	require.True(t, strings.Contains(got, "> _Transcript truncated (post-cap, 2 posts shown)._"),
		"expected truncation footer in output, got:\n%s", got)
}

func TestRenderRunMarkdown_SystemMessagesFilteredFromTranscript(t *testing.T) {
	rc := fixtureRun()
	rc.Transcript = append(rc.Transcript, report.RenderPost{
		PostID:   "sys1",
		AuthorID: "u1",
		CreateAt: 1_700_000_500_000,
		Message:  "joined the channel",
		Type:     "system_join_channel",
	})

	got := string(RenderRunMarkdown(rc))

	require.NotContains(t, got, "joined the channel", "system messages must be filtered out")
}
