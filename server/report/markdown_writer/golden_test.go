// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer //nolint:staticcheck

import (
	"flag"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report/reporttest"
)

var update = flag.Bool("update", false, "rewrite the golden files in testdata")

func TestGolden(t *testing.T) {
	for _, tc := range reporttest.RunScenarios() {
		t.Run(tc.Name, func(t *testing.T) {
			reporttest.AssertGolden(t, tc.Name+".md", RenderRunMarkdown(tc.Report()), *update)
		})
	}
}
