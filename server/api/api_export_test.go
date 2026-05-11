// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

func TestExport_ParseSectionsQuery_Run(t *testing.T) {
	t.Run("empty returns defaults with transcript default off", func(t *testing.T) {
		s, err := parseSectionsQuery("", sectionFlagsForRun, false)
		require.NoError(t, err)
		assert.True(t, s.Cover)
		assert.True(t, s.ExecutiveSummary)
		assert.True(t, s.Timeline)
		assert.True(t, s.StatusUpdates)
		assert.True(t, s.Checklists)
		assert.True(t, s.Retrospective)
		assert.False(t, s.Transcript)
	})

	t.Run("empty honors transcript default on", func(t *testing.T) {
		s, err := parseSectionsQuery("", sectionFlagsForRun, true)
		require.NoError(t, err)
		assert.True(t, s.Transcript)
	})

	t.Run("explicit subset", func(t *testing.T) {
		s, err := parseSectionsQuery("cover,summary", sectionFlagsForRun, false)
		require.NoError(t, err)
		assert.True(t, s.Cover)
		assert.True(t, s.ExecutiveSummary)
		assert.False(t, s.Timeline)
		assert.False(t, s.Checklists)
	})

	t.Run("unknown token is rejected", func(t *testing.T) {
		_, err := parseSectionsQuery("cover,bogus", sectionFlagsForRun, false)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "bogus")
	})

	t.Run("token whitespace and case", func(t *testing.T) {
		s, err := parseSectionsQuery(" COVER , Timeline ", sectionFlagsForRun, false)
		require.NoError(t, err)
		assert.True(t, s.Cover)
		assert.True(t, s.Timeline)
	})
}

func TestExport_ParseSectionsQuery_Playbook(t *testing.T) {
	t.Run("empty returns full playbook set", func(t *testing.T) {
		s, err := parseSectionsQuery("", sectionFlagsForPlaybook, false)
		require.NoError(t, err)
		assert.True(t, s.PlaybookOverview)
		assert.True(t, s.PlaybookChecklistTemplates)
		assert.True(t, s.PlaybookSettings)
	})

	t.Run("explicit subset", func(t *testing.T) {
		s, err := parseSectionsQuery("overview", sectionFlagsForPlaybook, false)
		require.NoError(t, err)
		assert.True(t, s.PlaybookOverview)
		assert.False(t, s.PlaybookChecklistTemplates)
		assert.False(t, s.PlaybookSettings)
	})

	t.Run("unknown token is rejected", func(t *testing.T) {
		_, err := parseSectionsQuery("overview,bogus", sectionFlagsForPlaybook, false)
		require.Error(t, err)
	})
}

func TestExport_SectionsToList_Sorted(t *testing.T) {
	got := sectionsToList(report.SectionFlags{
		Timeline:   true,
		Cover:      true,
		Transcript: true,
	})
	assert.Equal(t, []string{"cover", "timeline", "transcript"}, got)
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
	got := buildContentDisposition("Incident_Report")
	assert.Contains(t, got, `attachment;`)
	assert.Contains(t, got, `filename="Incident_Report.pdf"`)
	assert.Contains(t, got, `filename*=UTF-8''Incident_Report.pdf`)
}

func TestExport_CheckAcceptPDF(t *testing.T) {
	cases := []struct {
		name, header string
		wantErr      bool
	}{
		{"missing", "", false},
		{"wildcard", "*/*", false},
		{"application wildcard", "application/*", false},
		{"explicit pdf", "application/pdf", false},
		{"with q value", "application/pdf; q=0.9, */*; q=0.5", false},
		{"html only", "text/html", true},
		{"json only", "application/json", true},
	}
	h := &ExportHandler{}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tc.header != "" {
				req.Header.Set("Accept", tc.header)
			}
			err := h.checkAcceptPDF(req)
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestExport_CorrelationFromRequest(t *testing.T) {
	t.Run("echo X-Request-ID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("X-Request-ID", "abc-123")
		assert.Equal(t, "abc-123", correlationFromRequest(req))
	})
	t.Run("generate when missing", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		got := correlationFromRequest(req)
		assert.NotEmpty(t, got)
	})
}

func TestExport_ExportKey_StableAndDistinct(t *testing.T) {
	a := exportKey("run", "pdf", "abc", "user1", report.SectionFlags{Cover: true})
	b := exportKey("run", "pdf", "abc", "user1", report.SectionFlags{Cover: true})
	assert.Equal(t, a, b, "same inputs must produce same key")

	c := exportKey("run", "pdf", "abc", "user2", report.SectionFlags{Cover: true})
	assert.NotEqual(t, a, c, "different user must produce different key")

	d := exportKey("run", "pdf", "abc", "user1", report.SectionFlags{Timeline: true})
	assert.NotEqual(t, a, d, "different sections must produce different key")

	e := exportKey("playbook", "pdf", "abc", "user1", report.SectionFlags{Cover: true})
	assert.NotEqual(t, a, e, "different kind must produce different key")

	f := exportKey("run", "html", "abc", "user1", report.SectionFlags{Cover: true})
	assert.NotEqual(t, a, f, "different format must produce different key")
}

func TestExport_ReadSessionToken(t *testing.T) {
	t.Run("cookie", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.AddCookie(&http.Cookie{Name: "MMAUTHTOKEN", Value: "cookie-token"})
		assert.Equal(t, "cookie-token", readSessionToken(req))
	})
	t.Run("bearer", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer abc-bearer")
		assert.Equal(t, "abc-bearer", readSessionToken(req))
	})
	t.Run("none", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		assert.Equal(t, "", readSessionToken(req))
	})
}

func TestExport_CollapseUnderscores(t *testing.T) {
	assert.Equal(t, "a_b_c", collapseUnderscores("a___b__c"))
	assert.Equal(t, "abc", collapseUnderscores("abc"))
	assert.Equal(t, "_", collapseUnderscores("___"))
}
