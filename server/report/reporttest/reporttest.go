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

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
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
// translations loaded and users shown by full name.
func Options(locale string, location *time.Location) report.Options {
	if err := loadTranslations(); err != nil {
		panic(err)
	}
	return report.Options{
		T:          i18n.GetUserTranslations(locale),
		Locale:     locale,
		Location:   location,
		NameFormat: model.ShowFullName,
	}
}

// AllRunSections selects every run section, the transcript included.
func AllRunSections() report.SectionFlags {
	s := report.DefaultRunSections()
	s.Transcript = true
	return s
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

func users() map[string]report.RenderUser {
	return map[string]report.RenderUser{
		"u1": {UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
		"u2": {UserID: "u2", DisplayName: "Bob Builder", Username: "bob", Nickname: "Bobby"},
		"u3": {UserID: "u3", DisplayName: "Carol Chen", Username: "carol"},
		// u4 has no username, as for a user the requester can only partly see.
		"u4": {UserID: "u4", DisplayName: "Dana Display"},
	}
}

// RunScenarios returns the run report scenarios the golden tests render.
func RunScenarios() []RunScenario {
	chronological := TypicalRun()
	chronological.Run.Status = report.RunStatusInProgress
	chronological.Run.EndTimeMs = 0
	chronologicalOptions := Options("de", time.FixedZone("CET", 60*60))
	chronologicalOptions.TranscriptMode = report.TranscriptModeChronological

	truncated := TypicalRun()
	truncated.Transcript = truncated.Transcript[:3]
	truncated.TranscriptTruncation = report.Truncation{Hit: true, Reason: "posts"}

	omitted := TypicalRun()
	omitted.Transcript = nil
	omitted.TranscriptOmittedReason = report.TranscriptOmittedNotMember

	// Retrospectives not yet published, and canceled ones, are labelled.
	retroSections := report.SectionFlags{ExecutiveSummary: true, StatusUpdates: true, Retrospective: true}
	retroDraft := TypicalRun()
	retroDraft.Sections = retroSections
	retroDraft.Retrospective.Published = false
	retroCanceled := TypicalRun()
	retroCanceled.Sections = retroSections
	retroCanceled.Retrospective = report.RenderRetrospective{
		Body:         "No retrospective for this run.",
		Metrics:      retroDraft.Retrospective.Metrics,
		Canceled:     true,
		CanceledAt:   Base + 3*hour,
		CanceledByID: "u2",
	}

	// Only the executive summary, status updates and tasks were selected.
	sections := TypicalRun()
	sections.Sections = report.SectionFlags{ExecutiveSummary: true, StatusUpdates: true, Checklists: true}

	en := Options("en", time.UTC)
	byUsername := en
	byUsername.NameFormat = model.ShowUsername
	return []RunScenario{
		{"run_typical", TypicalRun(), en},
		{"run_empty", report.RenderContext{
			Run:               report.RenderRun{Status: report.RunStatusInProgress},
			Sections:          report.DefaultRunSections(),
			GeneratedAtMillis: GeneratedAt,
		}, en},
		// Users are shown by username, or by name when they have none.
		{"run_redacted", RedactedRun(), byUsername},
		// Shown in another language and time zone; strings without a
		// translation fall back to English.
		{"run_chronological", chronological, chronologicalOptions},
		{"run_truncated", truncated, en},
		{"run_transcript_omitted", omitted, en},
		{"run_sections", sections, en},
		{"run_retrospective_draft", retroDraft, en},
		{"run_retrospective_canceled", retroCanceled, en},
	}
}

// TypicalRun is a finished run with every section filled in.
func TypicalRun() report.RenderContext {
	return report.RenderContext{
		Sections: AllRunSections(),
		Run: report.RenderRun{
			Name:          "Database outage #42",
			Summary:       "Primary DB failed over. **Resolved** by @alice.\n\n- Replica promoted\n- Traffic drained",
			Status:        report.RunStatusFinished,
			StartTimeMs:   Base,
			EndTimeMs:     Base + 2*hour + 15*minute,
			PlaybookTitle: "Sev1 *Incident* Response",
			PlaybookURL:   "https://chat.example.com/playbooks/playbooks/pb1",
			ChannelName:   "Database outage (42)",
			ChannelURL:    "https://chat.example.com/ops/channels/database-outage-42",
		},
		Owner: report.RenderUser{UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
		Participants: []report.RenderUser{
			{UserID: "u1", DisplayName: "Alice Admin", Username: "alice"},
			{UserID: "u2", DisplayName: "Bob Builder", Username: "bob"},
			{UserID: "u3", DisplayName: "Carol Chen", Username: "carol"},
		},
		StatusUpdates: []report.RenderStatusUpdate{
			{AuthorID: "u1", CreateAt: Base + 5*minute, Message: "Investigating. cc @here"},
			{AuthorID: "u2", CreateAt: Base + 45*minute, Message: "Mitigated; **monitoring**."},
			{AuthorID: "u3", CreateAt: Base + 2*hour},
		},
		TimelineEvents: []report.RenderTimelineEvent{
			{EventType: "incident_created", CreateAt: Base, CreatorID: "u1"},
			{EventType: "task_state_modified", CreateAt: Base + 10*minute, SubjectID: "u1", Details: `{"action":"check","task":"Page on-call","item_id":"i1"}`},
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
					{Title: "Page on-call", State: report.ChecklistItemStateClosed, StateMs: Base + 10*minute, StateUserID: "u1", AssigneeID: "u1"},
					// Skipped by a user the timeline doesn't name.
					{Title: "Open war room", State: report.ChecklistItemStateSkipped, StateMs: Base + 11*minute},
					{Title: "Notify **stakeholders**", State: "in_progress", AssigneeID: "u2", DueAtMs: Base + hour},
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
					{Title: "Close incident", State: report.ChecklistItemStateClosed, StateMs: Base + 2*hour, StateUserID: "u2", AssigneeID: "u3"},
				},
			},
		},
		Retrospective: report.RenderRetrospective{
			Published: true,
			Body:      "## What went well\n- Quick paging",
			Metrics: []report.RenderMetric{
				{Title: "Time to detect", Description: "Measured from\nalert to ack", Type: "duration", Value: 3 * minute, HasValue: true},
				{Title: "Cost", Type: "currency", Value: 12345, HasValue: true},
				{Title: "Customers affected", Type: "integer", Value: 7, HasValue: true},
				{Title: "Time to resolve", Type: "duration"},
				{Title: "Time to escalate", Type: "duration", HasValue: true},
			},
		},
		Attributes: []report.RenderAttribute{
			{Name: "Severity", Text: []string{"Sev 2"}},
			{Name: "Users affected", Text: []string{"Alfred Morrison (Marketing), Jane Smith (Sales)"}},
			{Name: "Responders", UserIDs: []string{"u2", "u3"}},
			// A date picked without a time is stored as midnight UTC.
			{Name: "Detected", DateMs: time.Date(2023, 11, 14, 0, 0, 0, 0, time.UTC).UnixMilli()},
			{Name: "Customer ticket"},
		},
		Transcript: []report.RenderPost{
			{PostID: "tp1", AuthorID: "u1", CreateAt: Base + 2*minute, Message: "Looking into it. @channel"},
			{PostID: "tp3", AuthorID: "u3", CreateAt: Base + 4*minute, Message: "Dashboards are red:\n\n```\nerror rate 40%\n```"},
			{PostID: "tp2", AuthorID: "u2", CreateAt: Base + 6*minute, Message: "Same here.", RootID: "tp1"},
			{PostID: "tp4", AuthorID: "u3", CreateAt: Base + 8*minute, Message: "Following up on the earlier thread.", RootID: "missing"},
		},
		Users:             users(),
		GeneratedAtMillis: GeneratedAt,
	}
}

// RedactedRun is an in-progress run full of users the requester cannot
// fully resolve: unknown IDs and a user without a username.
func RedactedRun() report.RenderContext {
	return report.RenderContext{
		Sections: AllRunSections(),
		Run: report.RenderRun{
			Name:        "Login failures",
			Status:      report.RunStatusInProgress,
			StartTimeMs: Base,
		},
		Owner: report.RenderUser{UserID: "u9"},
		Participants: []report.RenderUser{
			{UserID: "u2", DisplayName: "Bob Builder", Username: "bob"},
			{UserID: "u4", DisplayName: "Dana Display"},
			{UserID: "u9"},
		},
		StatusUpdates: []report.RenderStatusUpdate{
			{AuthorID: "u4", CreateAt: Base + 5*minute, Message: "Checking the identity provider."},
			{AuthorID: "u9", CreateAt: Base + 10*minute, Message: "Rolled back the config."},
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
					{Title: "Check certificates", State: report.ChecklistItemStateSkipped, StateMs: Base + 6*minute, StateUserID: "u9", AssigneeID: "u9"},
				},
			},
		},
		Transcript: []report.RenderPost{
			{PostID: "tp1", AuthorID: "u4", CreateAt: Base + 2*minute, Message: "Seeing 500s from SSO."},
			{PostID: "tp2", AuthorID: "u9", CreateAt: Base + 3*minute, Message: "Confirmed.", RootID: "tp1"},
		},
		Users:             users(),
		GeneratedAtMillis: GeneratedAt,
	}
}
