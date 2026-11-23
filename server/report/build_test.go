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

	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
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
			Run:               RenderRun{Status: coretypes.RunStatusInProgress, StartTimeMs: testStart},
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
		assert.Contains(t, r.Meta, Field{Label: "Started", Value: "2023-11-14 23:13"})
		assert.Equal(t, "Generated 2023-11-14 23:13 CET.", r.Footer)
	})

	t.Run("no location means UTC", func(t *testing.T) {
		r := BuildRun(RenderContext{GeneratedAtMillis: testStart}, Options{T: testOptions().T})
		assert.Equal(t, "Generated 2023-11-14 22:13 UTC.", r.Footer)
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

		rc.TranscriptTruncation.Posts = 5000
		assert.Equal(t, "Transcript truncated (5000 posts shown).", BuildRun(rc, testOptions()).Transcript.Truncated)
	})

	t.Run("unassigned is only shown alongside a due date or command", func(t *testing.T) {
		rc := RenderContext{Checklists: []RenderChecklist{{Items: []RenderChecklistItem{
			{Title: "plain"},
			{Title: "due", DueAtMs: testStart},
		}}}}
		items := BuildRun(rc, testOptions()).Tasks.Checklists[0].Items
		assert.Empty(t, items[0].Assignee)
		assert.Equal(t, "Unassigned", items[1].Assignee)
		assert.Equal(t, "Due: 2023-11-14 22:13", items[1].Due)
	})
}

func TestBuildPlaybook(t *testing.T) {
	t.Run("checklist templates count their tasks", func(t *testing.T) {
		pc := PlaybookRenderContext{ChecklistTemplates: []RenderChecklist{
			{Title: "One", Items: []RenderChecklistItem{{Title: "a"}}},
			{Items: []RenderChecklistItem{{Title: "a"}, {Title: "b"}}},
		}}
		cls := BuildPlaybook(pc, testOptions()).Checklists.Checklists
		assert.Equal(t, "1 task", cls[0].Progress)
		assert.Equal(t, "Checklist 2", cls[1].Title)
		assert.Equal(t, "2 tasks", cls[1].Progress)
	})

	t.Run("members the requester cannot see are unknown users", func(t *testing.T) {
		pc := PlaybookRenderContext{
			Members:   []RenderPlaybookMember{{UserID: "u8", DisplayName: "Eve Elsewhere", Roles: []string{"playbook_admin", "custom"}}},
			Resolvers: ResolverTable{Users: map[string]RenderUser{}},
		}
		assert.Equal(t, []Member{{Name: "Unknown user", Roles: "Admin, custom"}}, BuildPlaybook(pc, testOptions()).Members.Members)
	})
}
