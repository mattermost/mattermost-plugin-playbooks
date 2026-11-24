// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer //nolint:staticcheck

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/reporttest"
)

func renderRun(rc report.RenderContext) string {
	return string(RenderRunMarkdown(report.BuildRun(rc, reporttest.Options("en", time.UTC))))
}

func TestRenderRunMarkdown_ResolverDenyPaths(t *testing.T) {
	rc := reporttest.TypicalRun()
	// Drop every user so each lookup goes through the deny path.
	rc.Users = map[string]report.RenderUser{}
	rc.Owner = report.RenderUser{UserID: "uX"}

	got := renderRun(rc)

	require.Contains(t, got, "**Owner**: Unknown user")
	require.Contains(t, got, "### Unknown user · ")
	require.Contains(t, got, "- [x] Page on-call\n  *(Assigned to Unknown user · Checked off by Unknown user on ")
	require.Contains(t, got, "> **Unknown user** · ")
	require.Contains(t, got, "> ↳ **Unknown user** · ")
}

func TestRenderRunMarkdown_PlainTextEscapedBodiesVerbatim(t *testing.T) {
	rc := reporttest.TypicalRun()
	rc.Run.Name = "# Not a heading"
	rc.Run.Summary = "# A heading"
	rc.Checklists[0].Title = "*not emphasis*"

	got := renderRun(rc)

	require.Contains(t, got, "# \\# Not a heading\n")
	require.Contains(t, got, "## Executive summary\n\n# A heading\n")
	require.Contains(t, got, "### \\*not emphasis\\* (2/4 · 50%)\n")
}

func TestRenderRunMarkdown_PlainHeadlineEscaped(t *testing.T) {
	rc := reporttest.TypicalRun()
	rc.Users["u1"] = report.RenderUser{UserID: "u1", DisplayName: "[Mallory](https://example.com)"}
	opts := reporttest.Options("en", time.UTC)
	opts.NameFormat = model.ShowFullName

	got := string(RenderRunMarkdown(report.BuildRun(rc, opts)))

	require.Contains(t, got, `\[Mallory\](https://example.com) created this run`)
}
