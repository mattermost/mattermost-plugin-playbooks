// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html_writer //nolint:staticcheck

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/reporttest"
)

func buildRun(rc report.RenderContext) *report.RunReport {
	return report.BuildRun(rc, reporttest.Options("en", time.UTC))
}

func TestRenderRunHTML_Lang(t *testing.T) {
	out, err := RenderRunHTML(report.BuildRun(reporttest.TypicalRun(), reporttest.Options("pt-BR", time.UTC)))
	require.NoError(t, err)
	assert.Contains(t, string(out), `<html lang="pt-BR">`)
}

// TestRenderRunHTML_MaliciousMarkdownNeutralized confirms an attacker
// shoving raw HTML / javascript URLs into status updates, summaries or plain
// text fields cannot escape into executable output.
func TestRenderRunHTML_MaliciousMarkdownNeutralized(t *testing.T) {
	rc := reporttest.TypicalRun()
	rc.Run.Name = `<script>steal()</script>`
	rc.Run.Summary = `<script>steal()</script> and [click](javascript:steal())`
	rc.StatusUpdates[0].Message = `<img src=x onerror="steal()">`
	rc.Retrospective.Body = `<iframe src="http://evil.example"></iframe>`
	rc.Retrospective.Metrics[0].Description = `<script>steal()</script>`

	out, err := RenderRunHTML(buildRun(rc))
	require.NoError(t, err)
	require.True(t, utf8.Valid(out))
	lower := strings.ToLower(string(out))
	for _, forbidden := range []string{"<script", "javascript:", "onerror", "<iframe", "evil.example"} {
		assert.NotContains(t, lower, forbidden)
	}
}
