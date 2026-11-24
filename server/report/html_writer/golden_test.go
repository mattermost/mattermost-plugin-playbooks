// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html_writer //nolint:staticcheck

import (
	"flag"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report/reporttest"
)

var update = flag.Bool("update", false, "rewrite the golden files in testdata")

func TestGolden(t *testing.T) {
	for _, tc := range reporttest.RunScenarios() {
		t.Run(tc.Name, func(t *testing.T) {
			out, err := RenderRunHTML(tc.Report())
			require.NoError(t, err)
			reporttest.AssertGolden(t, tc.Name+".html", out, *update)
		})
	}
}
