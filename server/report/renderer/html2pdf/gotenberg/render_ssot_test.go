// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package gotenberg

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/html_writer"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/renderer/html2pdf"
)

// TestRenderSSOT asserts that the bytes html_writer produces for the .html
// endpoint are byte-identical to what the Gotenberg adapter POSTs as its
// index.html multipart part. This is the single source of truth contract:
// the same document is served via the .html download and converted to PDF.
func TestRenderSSOT(t *testing.T) {
	// 1. Build a minimal RenderContext fixture (deterministic timestamps).
	rc := minimalRunFixture()
	opts := html_writer.Options{Title: "test", PageSize: "A4"}
	htmlBytes, err := html_writer.RenderRunHTML(rc, opts)
	require.NoError(t, err)
	require.NotEmpty(t, htmlBytes)

	// 2. Capture what the Gotenberg adapter POSTs.
	var capturedHTML []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseMultipartForm(10<<20))
		f, _, ferr := r.FormFile("files")
		require.NoError(t, ferr)
		defer f.Close()
		b, rerr := io.ReadAll(f)
		require.NoError(t, rerr)
		capturedHTML = b
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("%PDF-test"))
	}))
	defer srv.Close()

	client := New(Config{BaseURL: srv.URL})
	_, err = client.Render(context.Background(), htmlBytes, html2pdf.Options{PageSize: "A4"})
	require.NoError(t, err)

	// 3. Assert byte-equality — single source of truth.
	require.Equal(t, htmlBytes, capturedHTML,
		"html_writer output must be byte-identical to Gotenberg POST body (SSOT contract)")
}

// minimalRunFixture builds a small, deterministic RenderContext with one
// status update (plain text), one open checklist item, and no transcript.
func minimalRunFixture() report.RenderContext {
	return report.RenderContext{
		Run: report.RenderRun{
			ID:          "run1",
			Name:        "Fixture Run",
			Summary:     "Plain summary.",
			Status:      "InProgress",
			StartTimeMs: 1715439000000,
		},
		Owner: report.RenderUser{
			UserID:   "u1",
			Username: "alice",
		},
		StatusUpdates: []report.RenderStatusUpdate{
			{
				PostID:   "p1",
				AuthorID: "u1",
				CreateAt: 1715439300000,
				Message:  "All good.",
			},
		},
		Checklists: []report.RenderChecklist{
			{
				Title: "Initial",
				Items: []report.RenderChecklistItem{
					{Title: "Step one", State: ""},
				},
			},
		},
		Resolvers: report.ResolverTable{
			Users: map[string]report.RenderUser{
				"u1": {UserID: "u1", Username: "alice"},
			},
		},
		GeneratedAtMillis: 1715439600000,
	}
}
