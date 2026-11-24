// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// resolverWithAlice returns the users for actor-resolution paths: "u1" is
// alice.
func resolverWithAlice() map[string]RenderUser {
	return map[string]RenderUser{
		"u1": {UserID: "u1", Username: "alice", DisplayName: "Alice Admin"},
	}
}

// formatEvent builds one timeline line in English, in UTC.
func formatEvent(ev RenderTimelineEvent, rt map[string]RenderUser) TimelineEvent {
	return newBuilder(rt, testOptions()).timelineEvent(ev)
}

func TestTimelineEvent(t *testing.T) {
	rt := map[string]RenderUser{
		"u1": {UserID: "u1", Username: "alice", DisplayName: "Alice Admin"},
		"u2": {UserID: "u2", Username: "bob"},
	}
	type want struct {
		icon     TimelineIcon
		headline string
		detail   string
	}
	for _, tc := range []struct {
		name string
		ev   RenderTimelineEvent
		want want
	}{
		{"run started", RenderTimelineEvent{EventType: "incident_created", CreatorID: "u1"}, want{IconLifecycle, "Run started by alice", ""}},
		{"run finished", RenderTimelineEvent{EventType: "run_finished", SubjectID: "u1"}, want{IconLifecycle, "Run finished by alice", ""}},
		{"run restored", RenderTimelineEvent{EventType: "run_restored", SubjectID: "u1"}, want{IconLifecycle, "Run restored by alice", ""}},
		{"status posted", RenderTimelineEvent{EventType: "status_updated", SubjectID: "u1"}, want{IconStatus, "alice posted a status update", ""}},
		{"status changed", RenderTimelineEvent{EventType: "status_updated", SubjectID: "u1", Summary: "Active to Resolved"}, want{IconStatus, "alice changed status from Active to Resolved", ""}},
		{"status snoozed", RenderTimelineEvent{EventType: "status_update_snoozed", SubjectID: "u1"}, want{IconStatus, "alice snoozed a status update", ""}},
		{"status requested", RenderTimelineEvent{EventType: "status_update_requested", SubjectID: "u1"}, want{IconRequested, "alice requested a status update", ""}},
		{"owner changed", RenderTimelineEvent{EventType: "owner_changed", SubjectID: "u1", Summary: "@alice to @bob"}, want{IconEdit, "Owner changed from @alice to @bob", ""}},
		{"task checked", RenderTimelineEvent{EventType: "task_state_modified", SubjectID: "u1", Details: `{"action":"check","task":"Page on-call"}`}, want{IconTasks, `alice checked off checklist item "Page on-call"`, ""}},
		{"task without a title", RenderTimelineEvent{EventType: "task_state_modified", SubjectID: "u1", Details: `{"action":"skip"}`}, want{IconTasks, "alice skipped a checklist item", ""}},
		{"task with an unknown action", RenderTimelineEvent{EventType: "task_state_modified", SubjectID: "u1", Summary: "renamed **A**"}, want{IconTasks, `alice renamed "A"`, ""}},
		{"assignee changed", RenderTimelineEvent{EventType: "assignee_changed", SubjectID: "u1", Summary: "changed assignee of checklist item **A** from **No Assignee** to @bob"}, want{IconEdit, "Assignee Changed", "alice changed assignee of checklist item **A** from **No Assignee** to @bob"}},
		{"slash command", RenderTimelineEvent{EventType: "ran_slash_command", SubjectID: "u1", Summary: "ran the /echo command"}, want{IconEdit, "Slash Command Executed", "alice ran the /echo command"}},
		{"event from post", RenderTimelineEvent{EventType: "event_from_post", SubjectID: "u1", Summary: "Database failed over"}, want{IconEdit, "Database failed over", ""}},
		{"user joined", RenderTimelineEvent{EventType: "user_joined_left", SubjectID: "u1", Details: `{"action":"joined","requester":"alice","users":["alice"]}`}, want{IconPeople, "@alice joined the run", ""}},
		{"user left", RenderTimelineEvent{EventType: "user_joined_left", SubjectID: "u1", Details: `{"action":"left","requester":"alice","users":["alice"]}`}, want{IconPeople, "@alice left the run", ""}},
		{"user joined, older format", RenderTimelineEvent{EventType: "user_joined_left", Details: `{"title":"@alice joined the channel"}`}, want{IconPeople, "@alice joined the channel", ""}},
		// The subject is the added user; the requester comes from the details.
		{"participant added", RenderTimelineEvent{EventType: "participants_changed", SubjectID: "u2", Details: `{"action":"joined","requester":"alice","users":["bob"]}`}, want{IconPeople, "alice added @bob to the run", ""}},
		{"participants removed", RenderTimelineEvent{EventType: "participants_changed", SubjectID: "u1", Details: `{"action":"left","requester":"alice","users":["bob","carol"]}`}, want{IconPeople, "alice removed 2 participants from the run", "alice removed @bob, @carol from the run"}},
		{"retrospective published", RenderTimelineEvent{EventType: "published_retrospective", SubjectID: "u1"}, want{IconEdit, "Retrospective published by alice", ""}},
		{"retrospective canceled", RenderTimelineEvent{EventType: "canceled_retrospective", SubjectID: "u1"}, want{IconCanceled, "Retrospective canceled by alice", ""}},
		{"status updates enabled", RenderTimelineEvent{EventType: "status_updates_enabled", SubjectID: "u1"}, want{IconSettings, "Run status updates enabled by alice", ""}},
		{"status updates disabled", RenderTimelineEvent{EventType: "status_updates_disabled", SubjectID: "u1"}, want{IconSettings, "Run status updates disabled by alice", ""}},
		{"retrospective enabled", RenderTimelineEvent{EventType: "retrospective_enabled", SubjectID: "u1"}, want{IconSettings, "Retrospective enabled by alice", ""}},
		{"retrospective disabled", RenderTimelineEvent{EventType: "retrospective_disabled", SubjectID: "u1"}, want{IconSettings, "Retrospective disabled by alice", ""}},
		{"property set", RenderTimelineEvent{EventType: "property_changed", SubjectID: "u1", Details: `{"property_field_name":"Release","old_value_display":null,"new_value_display":"v1.2"}`}, want{IconEdit, "alice set Release to v1.2", ""}},
		{"property updated", RenderTimelineEvent{EventType: "property_changed", SubjectID: "u1", Details: `{"property_field_name":"Release","old_value_display":"v1.1","new_value_display":"v1.2"}`}, want{IconEdit, "alice updated Release from v1.1 to v1.2", ""}},
		{"property cleared", RenderTimelineEvent{EventType: "property_changed", SubjectID: "u1", Details: `{"property_field_name":"Release","old_value_display":"v1.1","new_value_display":null}`}, want{IconEdit, "alice cleared Release", ""}},
		{"unknown actor", RenderTimelineEvent{EventType: "run_finished", SubjectID: "ghost"}, want{IconLifecycle, "Run finished by Unknown user", ""}},
		{"unknown type with a summary", RenderTimelineEvent{EventType: "channel_archived", Summary: "Channel archived"}, want{"", "Channel archived", ""}},
		{"unknown type without a summary", RenderTimelineEvent{EventType: "channel_archived"}, want{"", "Timeline event", ""}},
		{"details that don't parse", RenderTimelineEvent{EventType: "participants_changed", Summary: "alice added bob", Details: "not json"}, want{IconPeople, "alice added bob", ""}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newBuilder(rt, testOptions()).timelineEvent(tc.ev)
			require.Equal(t, tc.want, want{f.Icon, f.Headline, strings.TrimSpace(f.DetailPlain + " " + f.Detail)})
		})
	}
}

func TestUserName(t *testing.T) {
	rt := resolverWithAlice()
	rt["u4"] = RenderUser{UserID: "u4", DisplayName: "Dana Display"}
	b := newBuilder(rt, testOptions())
	require.Equal(t, "alice", b.userName("u1"))
	require.Equal(t, "Dana Display", b.userName("u4"), "a user without a username shows by display name")
	require.Equal(t, "Unknown user", b.userName("ghost"))
	require.Equal(t, "Unknown user", b.userName(""))
}

func TestUserName_NameFormat(t *testing.T) {
	rt := map[string]RenderUser{
		"u1": {UserID: "u1", Username: "alice", DisplayName: "Alice Admin", Nickname: "Ali"},
		"u2": {UserID: "u2", Username: "bob", DisplayName: "Bob Builder"},
		// renderUserFromModel falls back to the username for users without a name.
		"u3": {UserID: "u3", Username: "carol", DisplayName: "carol"},
	}
	for format, want := range map[string][]string{
		"":                         {"alice", "bob", "carol"},
		model.ShowUsername:         {"alice", "bob", "carol"},
		model.ShowFullName:         {"Alice Admin", "Bob Builder", "carol"},
		model.ShowNicknameFullName: {"Ali", "Bob Builder", "carol"},
	} {
		opts := testOptions()
		opts.NameFormat = format
		b := newBuilder(rt, opts)
		require.Equal(t, want, []string{b.userName("u1"), b.userName("u2"), b.userName("u3")}, "format %q", format)
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
