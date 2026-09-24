// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// resolverWithAlice returns a resolver table that maps "u1" -> @alice for
// actor-resolution paths.
func resolverWithAlice() ResolverTable {
	return ResolverTable{
		Users: map[string]RenderUser{
			"u1": {UserID: "u1", Username: "alice", DisplayName: "Alice Admin"},
		},
	}
}

func TestFormatTimelineEvent_PerType(t *testing.T) {
	rt := resolverWithAlice()

	cases := []struct {
		name             string
		eventType        string
		summary          string
		wantLabel        string
		wantCategory     TimelineEventCategory
		wantHeadlineFull string // when summary is populated, headline should equal summary
		wantHeadlineSub  string // when summary is empty, headline should contain this substring
	}{
		{
			name: "incident_created", eventType: "incident_created",
			summary:          "Run created",
			wantLabel:        "Run created",
			wantCategory:     CategoryLifecycle,
			wantHeadlineFull: "Run created",
			wantHeadlineSub:  "@alice created this run",
		},
		{
			name: "status_updated", eventType: "status_updated",
			summary:          "alice posted an update",
			wantLabel:        "Status update posted",
			wantCategory:     CategoryStatus,
			wantHeadlineFull: "alice posted an update",
			wantHeadlineSub:  "@alice posted a status update",
		},
		{
			name: "status_update_requested", eventType: "status_update_requested",
			summary:          "requested",
			wantLabel:        "Status update requested",
			wantCategory:     CategoryStatus,
			wantHeadlineFull: "requested",
			wantHeadlineSub:  "@alice requested a status update",
		},
		{
			name: "owner_changed", eventType: "owner_changed",
			summary:          "@old to @new",
			wantLabel:        "Owner changed",
			wantCategory:     CategoryPeople,
			wantHeadlineFull: "@old to @new",
			wantHeadlineSub:  "@alice changed owner",
		},
		{
			name: "assignee_changed", eventType: "assignee_changed",
			summary:          "task assigned",
			wantLabel:        "Task reassigned",
			wantCategory:     CategoryPeople,
			wantHeadlineFull: "task assigned",
			wantHeadlineSub:  "@alice reassigned a task",
		},
		{
			name: "ran_slash_command", eventType: "ran_slash_command",
			summary:          "/run cmd",
			wantLabel:        "Slash command",
			wantCategory:     CategoryCommand,
			wantHeadlineFull: "/run cmd",
			wantHeadlineSub:  "@alice ran a slash command",
		},
		{
			name: "event_from_post", eventType: "event_from_post",
			summary:          "user posted",
			wantLabel:        "Channel post",
			wantCategory:     CategoryOther,
			wantHeadlineFull: "user posted",
			wantHeadlineSub:  "@alice posted in the channel",
		},
		{
			name: "user_joined_left", eventType: "user_joined_left",
			summary:          "joined",
			wantLabel:        "Channel membership",
			wantCategory:     CategoryPeople,
			wantHeadlineFull: "joined",
			wantHeadlineSub:  "@alice joined or left",
		},
		{
			name: "participants_changed", eventType: "participants_changed",
			summary:          "added bob",
			wantLabel:        "Participants changed",
			wantCategory:     CategoryPeople,
			wantHeadlineFull: "added bob",
			wantHeadlineSub:  "@alice changed participants",
		},
		{
			name: "published_retrospective", eventType: "published_retrospective",
			summary:          "Published",
			wantLabel:        "Retrospective published",
			wantCategory:     CategoryRetrospective,
			wantHeadlineFull: "Published",
			wantHeadlineSub:  "@alice published the retrospective",
		},
		{
			name: "canceled_retrospective", eventType: "canceled_retrospective",
			summary:          "Canceled",
			wantLabel:        "Retrospective canceled",
			wantCategory:     CategoryRetrospective,
			wantHeadlineFull: "Canceled",
			wantHeadlineSub:  "@alice canceled the retrospective",
		},
		{
			name: "run_finished", eventType: "run_finished",
			summary:          "Finished",
			wantLabel:        "Run finished",
			wantCategory:     CategoryLifecycle,
			wantHeadlineFull: "Finished",
			wantHeadlineSub:  "@alice marked this run finished",
		},
		{
			name: "run_restored", eventType: "run_restored",
			summary:          "Restored",
			wantLabel:        "Run restored",
			wantCategory:     CategoryLifecycle,
			wantHeadlineFull: "Restored",
			wantHeadlineSub:  "@alice restored this run",
		},
		{
			name: "status_update_snoozed", eventType: "status_update_snoozed",
			summary:          "Snoozed 1h",
			wantLabel:        "Status updates snoozed",
			wantCategory:     CategoryStatus,
			wantHeadlineFull: "Snoozed 1h",
			wantHeadlineSub:  "@alice snoozed status updates",
		},
		{
			name: "status_updates_enabled", eventType: "status_updates_enabled",
			summary:          "",
			wantLabel:        "Status updates enabled",
			wantCategory:     CategoryStatus,
			wantHeadlineFull: "",
			wantHeadlineSub:  "@alice enabled status updates",
		},
		{
			name: "status_updates_disabled", eventType: "status_updates_disabled",
			summary:          "",
			wantLabel:        "Status updates disabled",
			wantCategory:     CategoryStatus,
			wantHeadlineFull: "",
			wantHeadlineSub:  "@alice disabled status updates",
		},
		{
			name: "property_changed", eventType: "property_changed",
			summary:          "set priority",
			wantLabel:        "Property changed",
			wantCategory:     CategoryOther,
			wantHeadlineFull: "set priority",
			wantHeadlineSub:  "@alice changed a property",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name+"/with-summary", func(t *testing.T) {
			ev := RenderTimelineEvent{EventType: tc.eventType, Summary: tc.summary, SubjectID: "u1"}
			f := FormatTimelineEvent(ev, rt)
			require.Equal(t, tc.wantLabel, f.TypeLabel)
			require.Equal(t, tc.wantCategory, f.Category)
			if tc.wantHeadlineFull != "" {
				require.Equal(t, tc.wantHeadlineFull, f.Headline)
			} else {
				// Empty-summary path even though this branch is "with-summary":
				// some events (e.g. status_updates_enabled) have no plausible
				// non-empty summary; verify synthesized headline.
				require.Contains(t, f.Headline, tc.wantHeadlineSub)
			}
		})

		t.Run(tc.name+"/no-summary", func(t *testing.T) {
			ev := RenderTimelineEvent{EventType: tc.eventType, Summary: "", SubjectID: "u1"}
			f := FormatTimelineEvent(ev, rt)
			require.Equal(t, tc.wantLabel, f.TypeLabel)
			require.Equal(t, tc.wantCategory, f.Category)
			require.NotEmpty(t, f.Headline, "headline must never be blank")
			require.Contains(t, f.Headline, tc.wantHeadlineSub)
		})
	}
}

func TestFormatTimelineEvent_TaskStateModified_ParsesJSON(t *testing.T) {
	rt := resolverWithAlice()
	ev := RenderTimelineEvent{
		EventType: "task_state_modified",
		Summary:   "task changed",
		Details:   `{"item":"Page on-call","action":"check"}`,
		SubjectID: "u1",
	}
	f := FormatTimelineEvent(ev, rt)
	require.Equal(t, "Task updated", f.TypeLabel)
	require.Equal(t, CategoryTasks, f.Category)
	require.Contains(t, f.Headline, "@alice")
	require.Contains(t, f.Headline, "checked")
	require.Contains(t, f.Headline, "'Page on-call'")
	require.Empty(t, f.Detail, "raw JSON details must not leak into Detail")
}

func TestFormatTimelineEvent_TaskStateModified_AllActionVerbs(t *testing.T) {
	rt := resolverWithAlice()
	for action, verb := range map[string]string{
		"check":   "checked",
		"uncheck": "unchecked",
		"skip":    "skipped",
		"restore": "restored",
	} {
		ev := RenderTimelineEvent{
			EventType: "task_state_modified",
			Details:   `{"item":"T","action":"` + action + `"}`,
			SubjectID: "u1",
		}
		f := FormatTimelineEvent(ev, rt)
		require.Contains(t, f.Headline, verb, "action %q should map to verb %q", action, verb)
	}
}

func TestFormatTimelineEvent_TaskStateModified_InvalidJSONFallsBackToSummary(t *testing.T) {
	rt := resolverWithAlice()
	ev := RenderTimelineEvent{
		EventType: "task_state_modified",
		Summary:   "fallback summary",
		Details:   `{not json`,
		SubjectID: "u1",
	}
	f := FormatTimelineEvent(ev, rt)
	require.Equal(t, "Task updated", f.TypeLabel)
	require.Equal(t, "fallback summary", f.Headline)
	// Details opened with '{' so it looked like JSON: default rule drops it.
	require.Empty(t, f.Detail)
}

func TestFormatTimelineEvent_UnknownEventType(t *testing.T) {
	rt := resolverWithAlice()

	// With summary: passes through.
	ev := RenderTimelineEvent{EventType: "totally_unknown", Summary: "hello", SubjectID: "u1"}
	f := FormatTimelineEvent(ev, rt)
	require.Equal(t, "Event", f.TypeLabel)
	require.Equal(t, CategoryOther, f.Category)
	require.Equal(t, "hello", f.Headline)

	// No summary: fallback headline.
	ev2 := RenderTimelineEvent{EventType: "totally_unknown", Summary: "", SubjectID: "u1"}
	f2 := FormatTimelineEvent(ev2, rt)
	require.Equal(t, "Event", f2.TypeLabel)
	require.Equal(t, CategoryOther, f2.Category)
	require.Equal(t, "Timeline event", f2.Headline)
}

func TestResolveActorMention_MissingUser(t *testing.T) {
	rt := ResolverTable{Users: map[string]RenderUser{}}
	require.Equal(t, "Unknown user", resolveActorMention(rt, "ghost"))
	require.Equal(t, "Unknown user", resolveActorMention(rt, ""))
}

func TestResolveActorMention_KnownUser(t *testing.T) {
	rt := resolverWithAlice()
	require.Equal(t, "@alice", resolveActorMention(rt, "u1"))
}

func TestFormatTimelineEvent_PlainTextDetailsPassThrough(t *testing.T) {
	rt := resolverWithAlice()
	// owner_changed has no specific Details parsing, so plain-text Details
	// should reach the Detail field unmodified.
	ev := RenderTimelineEvent{
		EventType: "owner_changed",
		Summary:   "@old to @new",
		Details:   "Owner transferred due to handoff.",
		SubjectID: "u1",
	}
	f := FormatTimelineEvent(ev, rt)
	require.Equal(t, "Owner transferred due to handoff.", f.Detail)
}

func TestFormatTimelineEvent_UnknownJSONDetailsSuppressed(t *testing.T) {
	rt := resolverWithAlice()
	// Unknown event type with JSON-looking Details: must not leak the blob.
	ev := RenderTimelineEvent{
		EventType: "totally_unknown",
		Summary:   "something happened",
		Details:   `{"foo":"bar"}`,
		SubjectID: "u1",
	}
	f := FormatTimelineEvent(ev, rt)
	require.Equal(t, "something happened", f.Headline)
	require.Empty(t, f.Detail, "unrecognized JSON details must be dropped")
}

func TestFormatTimelineEvent_HeadlineNeverEmpty(t *testing.T) {
	// Every known event type with no summary and no actor must still produce
	// a non-empty Headline.
	rt := ResolverTable{Users: map[string]RenderUser{}}
	types := []string{
		"incident_created", "task_state_modified", "status_updated",
		"status_update_requested", "owner_changed", "assignee_changed",
		"ran_slash_command", "event_from_post", "user_joined_left",
		"participants_changed", "published_retrospective", "canceled_retrospective",
		"run_finished", "run_restored", "status_update_snoozed",
		"status_updates_enabled", "status_updates_disabled", "property_changed",
		"unknown_type_xyz",
	}
	for _, et := range types {
		f := FormatTimelineEvent(RenderTimelineEvent{EventType: et}, rt)
		require.NotEmpty(t, strings.TrimSpace(f.Headline), "event type %q produced empty headline", et)
	}
}

func TestParseTaskStateDetails_Robustness(t *testing.T) {
	// Valid.
	d := parseTaskStateDetails(`{"item":"X","action":"check"}`)
	require.Equal(t, "X", d.Item)
	require.Equal(t, "check", d.Action)

	// Empty.
	d2 := parseTaskStateDetails("")
	require.Equal(t, taskStateDetails{}, d2)

	// Garbage.
	d3 := parseTaskStateDetails(`not json at all`)
	require.Equal(t, taskStateDetails{}, d3)

	// Partial.
	d4 := parseTaskStateDetails(`{"item":"only-item"}`)
	require.Equal(t, "only-item", d4.Item)
	require.Equal(t, "", d4.Action)
}
