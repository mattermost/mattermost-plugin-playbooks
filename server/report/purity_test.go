// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestPackagePurity asserts that the server/report package and its
// sub-packages do not import server/app, pluginapi, net/http, or any other
// surface that would let arbitrary I/O escape the renderer's trust boundary.
//
// See plan §3.6.7 (resolver layering — pre-resolution table) and the security
// invariants in §3.6.8 / §8. The markdown extension must be pure data-in /
// PDF-out; ReportService does the I/O and permission scoping.
//
// This test enforces the rule mechanically so it cannot be quietly broken
// during MM-68716 / MM-68717.
func TestPackagePurity(t *testing.T) {
	pkgs := []string{
		"github.com/mattermost/mattermost-plugin-playbooks/server/report",
		// The markdown sub-packages join this list as they land in Phase A3 / A5.
	}

	// Imports that MUST NOT appear in any transitive dependency of these
	// packages. Each entry is matched as a substring of an import path.
	forbidden := []string{
		"github.com/mattermost/mattermost-plugin-playbooks/server/app",
		"github.com/mattermost/mattermost/server/public/pluginapi",
		"net/http",
	}

	for _, pkg := range pkgs {
		t.Run(pkg, func(t *testing.T) {
			out, err := exec.Command("go", "list", "-deps", "-f", "{{.ImportPath}}", pkg).Output()
			if err != nil {
				// On a fresh checkout before `go mod download` has run, this can fail.
				// Surface the original error for diagnosis but don't pretend purity.
				t.Fatalf("go list -deps %s failed: %v", pkg, err)
			}
			deps := strings.Split(strings.TrimSpace(string(out)), "\n")
			for _, dep := range deps {
				for _, bad := range forbidden {
					require.NotContainsf(t, dep, bad,
						"package %s transitively imports forbidden path %q via %q — plan §3.6.7 violation",
						pkg, bad, dep)
				}
			}
		})
	}
}
