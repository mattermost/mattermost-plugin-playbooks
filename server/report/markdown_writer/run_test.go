// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer //nolint:staticcheck

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/reporttest"
)

func renderRun(rc report.RenderContext) string {
	return string(RenderRunMarkdown(report.BuildRun(rc, reporttest.Options("en", time.UTC))))
}

func TestRenderRunMarkdown_ResolverDenyPaths(t *testing.T) {
	rc := reporttest.TypicalRun()
	// Wipe resolvers so every lookup goes through the deny path.
	rc.Resolvers = report.ResolverTable{Users: map[string]report.RenderUser{}}
	rc.Owner = report.RenderUser{UserID: "uX"}

	got := renderRun(rc)

	require.Contains(t, got, "**Owner**: Unknown user")
	require.Contains(t, got, "### Unknown user — ")
	require.Contains(t, got, "- [x] Page on-call\n  *(Unknown user)*")
	require.Contains(t, got, "> **Unknown user** — ")
	require.Contains(t, got, "> ↳ **Unknown user** — ")
}

func TestRenderRunMarkdown_PlainTextEscapedBodiesVerbatim(t *testing.T) {
	rc := reporttest.TypicalRun()
	rc.Run.Name = "# Not a heading"
	rc.Run.Summary = "# A heading"
	rc.Checklists[0].Title = "*not emphasis*"

	got := renderRun(rc)

	require.Contains(t, got, "# \\# Not a heading\n")
	require.Contains(t, got, "## Summary\n\n# A heading\n")
	require.Contains(t, got, "### \\*not emphasis\\* (2/4 · 50%)\n")
}

func TestRenderRunMarkdown_SystemMessagesFilteredFromTranscript(t *testing.T) {
	got := renderRun(reporttest.TypicalRun())
	require.NotContains(t, got, "joined the channel", "system messages must be filtered out")
}
