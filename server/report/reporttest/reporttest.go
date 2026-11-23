// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package reporttest holds the report fixtures and the golden-file helper
// shared by the report writers' tests. Only tests import it.
package reporttest

import (
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/i18n"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
)

// AssertGolden compares got with testdata/name, or rewrites the file when
// update is set (go test -update).
func AssertGolden(t *testing.T, name string, got []byte, update bool) {
	t.Helper()
	path := filepath.Join("testdata", name)
	if update {
		require.NoError(t, os.MkdirAll("testdata", 0o755))
		require.NoError(t, os.WriteFile(path, got, 0o600))
		return
	}
	want, err := os.ReadFile(path)
	require.NoError(t, err, "run go test -update to create the golden file")
	assert.Equal(t, string(want), string(got))
}

// Base is the start of every fixture run: 2023-11-14 22:13:20 UTC.
const Base int64 = 1_700_000_000_000

// GeneratedAt is when every fixture report is generated: Base + 3h.
const GeneratedAt = Base + 3*hour

const (
	minute int64 = 60 * 1000
	hour         = 60 * minute
)

var loadTranslations = sync.OnceValue(func() error {
	_, file, _, _ := runtime.Caller(0)
	return i18n.TranslationsPreInit(filepath.Join(filepath.Dir(file), "..", "..", "..", "assets", "i18n"))
})

// Options returns build options for locale and location, with the plugin's
// translations loaded.
func Options(locale string, location *time.Location) report.Options {
	if err := loadTranslations(); err != nil {
		panic(err)
	}
	return report.Options{T: i18n.GetUserTranslations(locale), Locale: locale, Location: location}
}

// RunScenario is a named run report input.
type RunScenario struct {
	Name    string
	Context report.RenderContext
	Options report.Options
}

// Report builds the scenario's report.
func (s RunScenario) Report() *report.RunReport {
	return report.BuildRun(s.Context, s.Options)
}

// PlaybookScenario is a named playbook report input.
type PlaybookScenario struct {
	Name    string
	Context report.PlaybookRenderContext
	Options report.Options
}

// Report builds the scenario's report.
func (s PlaybookScenario) Report() *report.PlaybookReport {
	return report.BuildPlaybook(s.Context, s.Options)
}

func users() map[string]report.RenderUser {
	return map[string]report.RenderUser{
		"u1": {UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
		"u2": {UserID: "u2", DisplayName: "Bob Builder", Username: "bob"},
		"u3": {UserID: "u3", DisplayName: "Carol Chen", Username: "carol"},
		// u4 has no username, as for a user the requester can only partly see.
		"u4": {UserID: "u4", DisplayName: "Dana Display"},
	}
}

// RunScenarios returns the run report scenarios the golden tests render.
func RunScenarios() []RunScenario {
	chronological := TypicalRun()
	chronological.Run.Status = coretypes.RunStatusInProgress
	chronological.Run.EndTimeMs = 0
	chronological.TranscriptMode = coretypes.TranscriptModeChronological

	truncated := TypicalRun()
	truncated.TranscriptTruncation = report.Truncation{Hit: true, Reason: "posts", Posts: 3}

	omitted := TypicalRun()
	omitted.Transcript = nil
	omitted.TranscriptOmittedReason = coretypes.TranscriptOmittedNotMember

	en := Options("en", time.UTC)
	return []RunScenario{
		{"run_typical", TypicalRun(), en},
		{"run_empty", report.RenderContext{
			Run:               report.RenderRun{ID: "run2", Status: coretypes.RunStatusInProgress},
			GeneratedAtMillis: GeneratedAt,
		}, en},
		{"run_redacted", RedactedRun(), en},
		// Shown in another language and time zone; strings without a
		// translation fall back to English.
		{"run_chronological", chronological, Options("de", time.FixedZone("CET", 60*60))},
		{"run_truncated", truncated, en},
		{"run_transcript_omitted", omitted, en},
	}
}

// TypicalRun is a finished run with every section filled in.
func TypicalRun() report.RenderContext {
	return report.RenderContext{
		Run: report.RenderRun{
			ID:            "run1",
			Name:          "Database outage #42",
			Summary:       "Primary DB failed over. **Resolved** by @alice.\n\n- Replica promoted\n- Traffic drained",
			Status:        coretypes.RunStatusFinished,
			StartTimeMs:   Base,
			EndTimeMs:     Base + 2*hour + 15*minute,
			PlaybookID:    "pb1",
			PlaybookTitle: "Sev1 *Incident* Response",
		},
		Owner: report.RenderUser{UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
		Participants: []report.RenderUser{
			{UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
			{UserID: "u2", DisplayName: "Bob Builder", Username: "bob"},
			{UserID: "u3", DisplayName: "Carol Chen", Username: "carol"},
		},
		StatusUpdates: []report.RenderStatusUpdate{
			{PostID: "p1", AuthorID: "u1", CreateAt: Base + 5*minute, Message: "Investigating. cc @here"},
			{PostID: "p2", AuthorID: "u2", CreateAt: Base + 45*minute, Message: "Mitigated; **monitoring**."},
			{PostID: "p3", AuthorID: "u3", CreateAt: Base + 2*hour},
		},
		TimelineEvents: []report.RenderTimelineEvent{
			{EventType: "incident_created", CreateAt: Base, CreatorID: "u1"},
			{EventType: "task_state_modified", CreateAt: Base + 10*minute, SubjectID: "u1", Details: `{"item":"Page on-call","action":"check"}`},
			{EventType: "task_state_modified", CreateAt: Base + 11*minute, SubjectID: "u2", Details: `{"action":"skip"}`},
			{EventType: "status_updated", CreateAt: Base + 45*minute, SubjectID: "u2", Summary: "@bob posted a status update", Details: "Mitigated; monitoring."},
			{EventType: "owner_changed", CreateAt: Base + hour, SubjectID: "u2"},
			{EventType: "custom_event", CreateAt: Base + hour + 30*minute, Details: `{"x":1}`},
			{EventType: "run_finished", CreateAt: Base + 2*hour + 15*minute, CreatorID: "u1"},
		},
		Checklists: []report.RenderChecklist{
			{
				Title: "Initial response",
				Items: []report.RenderChecklistItem{
					{Title: "Page on-call", State: coretypes.ChecklistItemStateClosed, AssigneeID: "u1"},
					{Title: "Open war room", State: coretypes.ChecklistItemStateSkipped},
					{Title: "Notify **stakeholders**", State: coretypes.ChecklistItemStateInProgress, AssigneeID: "u2", DueAtMs: Base + hour},
					{
						Title:       "Postmortem doc",
						DueAtMs:     Base + 26*hour,
						Description: "Write it up.\nShare with @carol.",
						Command:     "/postmortem create",
					},
				},
			},
			{},
			{
				Title: "Wrap-up",
				Items: []report.RenderChecklistItem{
					{Title: "Close incident", State: coretypes.ChecklistItemStateClosed, AssigneeID: "u3"},
				},
			},
		},
		Retrospective: report.RenderRetrospective{
			Body:        "## What went well\n- Quick paging",
			PublishedMs: Base + 2*hour + 30*minute,
			Metrics: []report.RenderMetric{
				{ID: "m1", Title: "Time to detect", Description: "Measured from\nalert to ack", Type: "duration", Target: 5 * minute, Value: 3 * minute, HasValue: true},
				{ID: "m2", Title: "Cost", Type: "currency", Target: 100000, Value: 12345, HasValue: true},
				{ID: "m3", Title: "Customers affected", Type: "integer", Target: 0, Value: 7, HasValue: true},
				{ID: "m4", Title: "Time to resolve", Type: "duration", Target: hour},
				{ID: "m5", Title: "Time to escalate", Type: "duration", HasValue: true},
			},
		},
		Transcript: []report.RenderPost{
			{PostID: "tp1", AuthorID: "u1", CreateAt: Base + 2*minute, Message: "Looking into it. @channel"},
			{PostID: "tp3", AuthorID: "u3", CreateAt: Base + 4*minute, Message: "Dashboards are red:\n\n```\nerror rate 40%\n```"},
			{PostID: "tp2", AuthorID: "u2", CreateAt: Base + 6*minute, Message: "Same here.", RootID: "tp1"},
			{PostID: "sys1", AuthorID: "u2", CreateAt: Base + 7*minute, Message: "bob joined the channel", Type: "system_join_channel"},
			{PostID: "tp4", AuthorID: "u3", CreateAt: Base + 8*minute, Message: "Following up on the earlier thread.", RootID: "missing"},
		},
		Resolvers:         report.ResolverTable{Users: users()},
		GeneratedAtMillis: GeneratedAt,
	}
}

// RedactedRun is an in-progress run full of users the requester cannot
// fully resolve: unknown IDs and a user without a username.
func RedactedRun() report.RenderContext {
	return report.RenderContext{
		Run: report.RenderRun{
			ID:          "run3",
			Name:        "Login failures",
			Status:      coretypes.RunStatusInProgress,
			StartTimeMs: Base,
		},
		Owner: report.RenderUser{UserID: "u9"},
		Participants: []report.RenderUser{
			{UserID: "u2", DisplayName: "Bob Builder", Username: "bob"},
			{UserID: "u4", DisplayName: "Dana Display"},
			{UserID: "u9"},
		},
		StatusUpdates: []report.RenderStatusUpdate{
			{PostID: "p1", AuthorID: "u4", CreateAt: Base + 5*minute, Message: "Checking the identity provider."},
			{PostID: "p2", AuthorID: "u9", CreateAt: Base + 10*minute, Message: "Rolled back the config."},
		},
		TimelineEvents: []report.RenderTimelineEvent{
			{EventType: "incident_created", CreateAt: Base, CreatorID: "u4"},
			{EventType: "assignee_changed", CreateAt: Base + 3*minute, SubjectID: "u9"},
			{EventType: "task_state_modified", CreateAt: Base + 4*minute, Details: `{"item":"Check IdP","action":"restore"}`},
		},
		Checklists: []report.RenderChecklist{
			{
				Title: "Triage",
				Items: []report.RenderChecklistItem{
					{Title: "Check IdP", AssigneeID: "u4"},
					{Title: "Check certificates", State: coretypes.ChecklistItemStateClosed, AssigneeID: "u9"},
				},
			},
		},
		Transcript: []report.RenderPost{
			{PostID: "tp1", AuthorID: "u4", CreateAt: Base + 2*minute, Message: "Seeing 500s from SSO."},
			{PostID: "tp2", AuthorID: "u9", CreateAt: Base + 3*minute, Message: "Confirmed.", RootID: "tp1"},
		},
		Resolvers:         report.ResolverTable{Users: users()},
		GeneratedAtMillis: GeneratedAt,
	}
}

// PlaybookScenarios returns the playbook report scenarios the golden tests
// render.
func PlaybookScenarios() []PlaybookScenario {
	en := Options("en", time.UTC)
	return []PlaybookScenario{
		{"playbook_typical", TypicalPlaybook(), en},
		{"playbook_empty", report.PlaybookRenderContext{
			Playbook:          report.RenderPlaybook{ID: "pb2"},
			GeneratedAtMillis: GeneratedAt,
		}, en},
		{"playbook_redacted", RedactedPlaybook(), en},
	}
}

// TypicalPlaybook is a public playbook with every section filled in.
func TypicalPlaybook() report.PlaybookRenderContext {
	return report.PlaybookRenderContext{
		Playbook: report.RenderPlaybook{
			ID:          "pb1",
			Title:       "Sev1 *Incident* Response",
			Description: "Standard response **playbook**. Ask @alice.",
			Public:      true,
			TeamID:      "t1",
		},
		Members: []report.RenderPlaybookMember{
			{UserID: "u1", DisplayName: "Alice Admin", Roles: []string{"playbook_admin", "playbook_member"}},
			{UserID: "u2", DisplayName: "Bob Builder", Roles: []string{"playbook_member"}},
			{UserID: "u3", DisplayName: "Carol Chen"},
		},
		ChecklistTemplates: []report.RenderChecklist{
			{
				Title: "Triage",
				Items: []report.RenderChecklistItem{
					{Title: "Acknowledge alert", AssigneeID: "u1", DueAtMs: Base + hour},
					{Title: "Verify **scope**", Description: "Check dashboards\nand logs.", Command: "/dash open"},
				},
			},
			{Items: []report.RenderChecklistItem{{Title: "Untitled list task"}}},
			{Title: "Empty list"},
		},
		StatusUpdateConfig: report.RenderStatusUpdateConfig{
			Enabled:  true,
			Template: "**What's the latest?**",
			Cadence:  "Every 30 minutes",
		},
		RetrospectiveConfig: report.RenderRetrospectiveConfig{
			Enabled:         true,
			Template:        "## Retro",
			ReminderCadence: "After resolution",
			Metrics: []report.RenderMetric{
				{ID: "m1", Title: "Time to detect", Description: "From alert to ack", Type: "duration", Target: 5 * minute},
				{ID: "m2", Title: "Cost", Type: "currency", Target: 100000},
				{ID: "m3", Title: "Customers affected", Type: "integer", Target: 10},
				{ID: "m4", Title: "Time to escalate", Type: "duration"},
			},
		},
		BroadcastChannels: []report.RenderChannel{
			{ChannelID: "c1", Name: "incidents", DisplayName: "Incidents", Type: "O"},
			{ChannelID: "c2", Name: "leadership", DisplayName: "Leadership", Type: "P"},
		},
		WebhooksOnCreation: []report.RenderWebhook{
			{Full: "https://hooks.example.com/abc", HostMasked: "https://hooks.example.com/****"},
		},
		WebhooksOnStatus: []report.RenderWebhook{
			{HostMasked: "https://hooks.example.com/****"},
		},
		SignalKeywords:    []string{"sev1", "out`age"},
		Resolvers:         report.ResolverTable{Users: users()},
		GeneratedAtMillis: GeneratedAt,
	}
}

// RedactedPlaybook is a private playbook with members, channels and
// webhooks the requester cannot fully see, and partial settings.
func RedactedPlaybook() report.PlaybookRenderContext {
	return report.PlaybookRenderContext{
		Playbook: report.RenderPlaybook{ID: "pb3", Title: "Access requests"},
		Members: []report.RenderPlaybookMember{
			{UserID: "u4", DisplayName: "Dana Display", Roles: []string{"playbook_admin"}},
			{UserID: "u8", DisplayName: "Eve Elsewhere", Roles: []string{"playbook_member"}},
			{UserID: "u9"},
		},
		StatusUpdateConfig: report.RenderStatusUpdateConfig{Cadence: "Every day"},
		RetrospectiveConfig: report.RenderRetrospectiveConfig{
			Metrics: []report.RenderMetric{{ID: "m1", Title: "Requests handled", Type: "integer", Target: 3}},
		},
		BroadcastChannels:  []report.RenderChannel{{ChannelID: "c9"}},
		WebhooksOnCreation: []report.RenderWebhook{{}, {HostMasked: "https://hooks.example.com/****"}},
		Resolvers:          report.ResolverTable{Users: users()},
		GeneratedAtMillis:  GeneratedAt,
	}
}
