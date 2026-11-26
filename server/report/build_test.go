// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/stretchr/testify/assert"
)

func TestMain(m *testing.M) {
	if err := i18n.TranslationsPreInit(filepath.Join("..", "..", "assets", "i18n")); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func testOptions() Options {
	return Options{T: i18n.GetUserTranslations("en"), Location: time.UTC}
}

const testStart int64 = 1_700_000_000_000 // 2023-11-14 22:13:20 UTC

func TestBuildRun(t *testing.T) {
	t.Run("an in-progress run lasts until the report was generated", func(t *testing.T) {
		rc := RenderContext{
			Run:               RenderRun{Status: RunStatusInProgress, StartTimeMs: testStart},
			GeneratedAtMillis: testStart + (90 * time.Minute).Milliseconds(),
		}
		r := BuildRun(rc, testOptions())
		assert.Equal(t, Stat{Label: "Duration", Value: "1h 30m"}, r.Stats[3])
	})

	t.Run("times are shown in the requester's time zone", func(t *testing.T) {
		rc := RenderContext{
			Run:               RenderRun{StartTimeMs: testStart},
			GeneratedAtMillis: testStart,
		}
		opts := testOptions()
		opts.Location = time.FixedZone("CET", 60*60)
		r := BuildRun(rc, opts)
		assert.Contains(t, r.Details, Field{Label: "Started", Value: "November 14, 2023, 11:13 PM CET"})
		assert.Equal(t, "Generated November 14, 2023, 11:13 PM CET.", r.Footer)
	})

	t.Run("no location means UTC", func(t *testing.T) {
		r := BuildRun(RenderContext{GeneratedAtMillis: testStart}, Options{T: testOptions().T})
		assert.Equal(t, "Generated November 14, 2023, 10:13 PM UTC.", r.Footer)
		assert.Equal(t, "en", r.Lang)
	})

	t.Run("the language is a BCP 47 tag", func(t *testing.T) {
		opts := testOptions()
		opts.Locale = "zh_Hans"
		assert.Equal(t, "zh-Hans", BuildRun(RenderContext{}, opts).Lang)
	})

	t.Run("truncation counts posts with plurals", func(t *testing.T) {
		rc := RenderContext{
			Transcript:           []RenderPost{{PostID: "p1", AuthorID: "u1", Message: "hi"}},
			TranscriptTruncation: Truncation{Hit: true, Reason: "bytes"},
		}
		assert.Equal(t, "Transcript truncated (1 post shown).", BuildRun(rc, testOptions()).Transcript.Truncated)

		rc.Transcript = append(rc.Transcript, RenderPost{PostID: "p2", AuthorID: "u1", Message: "there"})
		assert.Equal(t, "Transcript truncated (2 posts shown).", BuildRun(rc, testOptions()).Transcript.Truncated)
	})

	t.Run("a published retrospective's measured metrics are the headline figures", func(t *testing.T) {
		labels := func(retro RenderRetrospective) []string {
			var out []string
			for _, s := range BuildRun(RenderContext{Retrospective: retro}, testOptions()).Stats {
				out = append(out, s.Label+"="+s.Value)
			}
			return out
		}
		metrics := []RenderMetric{
			{Title: "Detect", Type: "duration", Value: 60_000, HasValue: true},
			{Title: "Unset", Type: "integer"},
			{Title: "Cost", Type: "currency", Value: 5, HasValue: true},
			{Title: "Users", Type: "integer", Value: 3, HasValue: true},
			{Title: "Zero", Type: "integer", Value: 0, HasValue: true},
			{Title: "Fifth", Type: "integer", Value: 9, HasValue: true},
		}
		generic := []string{"Tasks=0/0", "Updates=0", "Participants=0", "Duration=-"}

		assert.Equal(t, []string{"Detect=1m 0s", "Cost=5", "Users=3", "Zero=0"}, labels(RenderRetrospective{Published: true, Metrics: metrics}))
		assert.Equal(t, generic, labels(RenderRetrospective{Metrics: metrics}), "a draft's metrics may still change")
		assert.Equal(t, generic, labels(RenderRetrospective{Canceled: true, Metrics: metrics}))
		assert.Equal(t, generic, labels(RenderRetrospective{Published: true, Metrics: []RenderMetric{{Title: "Unset"}}}))
	})

	t.Run("attributes follow the participants in the details", func(t *testing.T) {
		rc := RenderContext{
			Users: map[string]RenderUser{"u1": {UserID: "u1", Username: "alice"}},
			Attributes: []RenderAttribute{
				{Name: "Severity", Text: []string{"Sev 1", "Sev 2"}},
				{Name: "Responders", UserIDs: []string{"u1", "ghost"}},
				// A picked date is midnight UTC and keeps its day anywhere.
				{Name: "Detected", DateMs: time.Date(2023, 11, 14, 0, 0, 0, 0, time.UTC).UnixMilli()},
				// Any other time is shown in the report's time zone.
				{Name: "Due", DateMs: time.Date(2023, 11, 14, 23, 30, 0, 0, time.UTC).UnixMilli()},
				{Name: "Ticket"},
			},
		}
		opts := testOptions()
		opts.Location = time.FixedZone("CET", 60*60)
		var got []string
		for _, f := range BuildRun(rc, opts).Details {
			got = append(got, f.Label+": "+f.Value)
		}
		assert.Equal(t, []string{
			"Owner: Unknown user",
			"Severity: Sev 1, Sev 2",
			"Responders: alice, Unknown user",
			"Detected: November 14, 2023",
			"Due: November 15, 2023",
			"Ticket: Not set",
		}, got)
	})

	t.Run("retrospective notes", func(t *testing.T) {
		users := map[string]RenderUser{"u1": {UserID: "u1", Username: "alice"}}
		retro := func(r RenderRetrospective) RetrospectiveSection {
			return BuildRun(RenderContext{Retrospective: r, Users: users}, testOptions()).Retrospective
		}

		published := retro(RenderRetrospective{Published: true, Body: "done"})
		assert.Empty(t, published.Note)
		assert.Equal(t, "done", published.Body)

		draft := retro(RenderRetrospective{Body: "so far"})
		assert.Equal(t, "Draft: this retrospective hasn't been published yet.", draft.Note)
		assert.Equal(t, "so far", draft.Body)
		assert.Empty(t, retro(RenderRetrospective{}).Note, "an empty draft is just no retrospective")

		canceled := retro(RenderRetrospective{
			Canceled: true, CanceledAt: testStart, CanceledByID: "u1",
			Body: "No retrospective for this run.", Metrics: []RenderMetric{{Title: "Cost"}},
		})
		assert.Equal(t, "The retrospective was canceled by alice on November 14, 2023, 10:13 PM UTC.", canceled.Note)
		assert.Empty(t, canceled.Body)
		assert.Empty(t, canceled.Metrics)
		assert.Equal(t, "The retrospective was canceled on November 14, 2023, 10:13 PM UTC.",
			retro(RenderRetrospective{Canceled: true, CanceledAt: testStart}).Note)
		assert.Equal(t, "The retrospective was canceled.",
			retro(RenderRetrospective{Canceled: true, CanceledByID: "u1"}).Note)
	})

	t.Run("unassigned is only shown alongside a due date or command", func(t *testing.T) {
		rc := RenderContext{Checklists: []RenderChecklist{{Items: []RenderChecklistItem{
			{Title: "plain"},
			{Title: "due", DueAtMs: testStart},
		}}}}
		items := BuildRun(rc, testOptions()).Tasks.Checklists[0].Items
		assert.Empty(t, items[0].Assignee)
		assert.Equal(t, "Unassigned", items[1].Assignee)
		assert.Equal(t, "Due: November 14, 2023, 10:13 PM UTC", items[1].Due)
	})

	t.Run("closed and skipped tasks say who changed them and when", func(t *testing.T) {
		rc := RenderContext{
			Checklists: []RenderChecklist{{Items: []RenderChecklistItem{
				{Title: "checked", State: ChecklistItemStateClosed, StateMs: testStart, StateUserID: "u1"},
				{Title: "checked, by whom unknown", State: ChecklistItemStateClosed, StateMs: testStart},
				{Title: "skipped", State: ChecklistItemStateSkipped, StateMs: testStart, StateUserID: "u1"},
				{Title: "skipped, by whom unknown", State: ChecklistItemStateSkipped, StateMs: testStart},
				{Title: "open", StateMs: testStart, StateUserID: "u1"},
				{Title: "closed at an unknown time", State: ChecklistItemStateClosed, StateUserID: "u1"},
			}}},
			Users: map[string]RenderUser{"u1": {UserID: "u1", Username: "alice"}},
		}
		var got []string
		for _, it := range BuildRun(rc, testOptions()).Tasks.Checklists[0].Items {
			got = append(got, it.Completed)
		}
		assert.Equal(t, []string{
			"Checked off by alice on November 14, 2023, 10:13 PM UTC",
			"Checked off on November 14, 2023, 10:13 PM UTC",
			"Skipped by alice on November 14, 2023, 10:13 PM UTC",
			"Skipped on November 14, 2023, 10:13 PM UTC",
			"",
			"",
		}, got)
	})

	t.Run("unselected sections are omitted", func(t *testing.T) {
		r := BuildRun(RenderContext{Sections: SectionFlags{ExecutiveSummary: true, StatusUpdates: true, Retrospective: true}}, testOptions())
		assert.False(t, r.Summary.Omitted)
		assert.False(t, r.StatusUpdates.Omitted)
		assert.False(t, r.Retrospective.Omitted)
		assert.True(t, r.Timeline.Omitted)
		assert.True(t, r.Tasks.Omitted)
		assert.True(t, r.Transcript.Omitted)
	})
}

func TestTrimBody(t *testing.T) {
	assert.Equal(t, "", trimBody(" \n\t\n"))
	assert.Equal(t, "text", trimBody("\n\ntext  \n"))
	assert.Equal(t, "    code", trimBody("\n  \n    code\n"))
	assert.Equal(t, "a\n\n  b", trimBody("a\n\n  b\n\n"))
}
