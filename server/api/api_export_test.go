// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

func TestExport_ParseSectionsQuery(t *testing.T) {
	t.Run("empty returns defaults without the transcript", func(t *testing.T) {
		s, err := parseSectionsQuery("")
		require.NoError(t, err)
		assert.True(t, s.ExecutiveSummary)
		assert.True(t, s.Timeline)
		assert.True(t, s.StatusUpdates)
		assert.True(t, s.Checklists)
		assert.True(t, s.Retrospective)
		assert.False(t, s.Transcript)
	})

	t.Run("explicit subset", func(t *testing.T) {
		s, err := parseSectionsQuery("summary,tasks")
		require.NoError(t, err)
		assert.True(t, s.ExecutiveSummary)
		assert.True(t, s.Checklists)
		assert.False(t, s.Timeline)
		assert.False(t, s.Transcript)
	})

	t.Run("unknown token is rejected", func(t *testing.T) {
		_, err := parseSectionsQuery("summary,bogus")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "bogus")
	})

	t.Run("token whitespace and case", func(t *testing.T) {
		s, err := parseSectionsQuery(" RETRO , Timeline ")
		require.NoError(t, err)
		assert.True(t, s.Retrospective)
		assert.True(t, s.Timeline)
	})
}

func TestExport_SectionsToList_Sorted(t *testing.T) {
	got := sectionsToList(report.SectionFlags{
		Transcript:       true,
		Timeline:         true,
		ExecutiveSummary: true,
	})
	assert.Equal(t, []string{"summary", "timeline", "transcript"}, got)
}

func TestExport_ParseTimeZone(t *testing.T) {
	t.Run("empty means the requester's own time zone", func(t *testing.T) {
		location, err := parseTimeZone("")
		require.NoError(t, err)
		assert.Nil(t, location)
	})

	t.Run("IANA name", func(t *testing.T) {
		location, err := parseTimeZone("Asia/Karachi")
		require.NoError(t, err)
		assert.Equal(t, "Asia/Karachi", location.String())
	})

	for _, raw := range []string{"Local", "Not/AZone", "../../etc/passwd", "/etc/localtime"} {
		t.Run("rejects "+raw, func(t *testing.T) {
			_, err := parseTimeZone(raw)
			require.Error(t, err)
		})
	}
}

func TestExport_SafeFilename(t *testing.T) {
	cases := []struct {
		name, in, fallback, want string
	}{
		{"plain ascii", "Incident Report", "run-X", "Incident_Report"},
		{"path traversal stripped", "../../etc/passwd", "run-X", "etc_passwd"},
		{"unicode replaced", "Q3 — résumé", "run-X", "Q3_r_sum"},
		{"empty falls back", "", "run-X", "run-X"},
		{"whitespace only falls back", "    ", "run-X", "run-X"},
		{"truncated to 80", strings.Repeat("a", 200), "run-X", strings.Repeat("a", 80)},
		{"hyphen and dot preserved", "v1.2-final", "run-X", "v1.2-final"},
		{"leading/trailing punctuation trimmed", "...title...", "run-X", "title"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := safeFilename(tc.in, tc.fallback)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestExport_BuildContentDisposition(t *testing.T) {
	got := buildContentDisposition("Incident_Report", "md")
	assert.Equal(t, `attachment; filename="Incident_Report.md"; filename*=UTF-8''Incident_Report.md`, got)
}

func TestExport_ReportFilename(t *testing.T) {
	generatedAt := time.Date(2026, 11, 23, 14, 5, 0, 0, time.UTC).UnixMilli()
	assert.Equal(t, "Database_outage_2026-11-23T14-05", reportFilename("Database outage", "run-abc", generatedAt))
	assert.Equal(t, "run-abc_2026-11-23T14-05", reportFilename("", "run-abc", generatedAt))
}

func TestExport_CollapseUnderscores(t *testing.T) {
	assert.Equal(t, "a_b_c", collapseUnderscores("a___b__c"))
	assert.Equal(t, "abc", collapseUnderscores("abc"))
	assert.Equal(t, "_", collapseUnderscores("___"))
}
