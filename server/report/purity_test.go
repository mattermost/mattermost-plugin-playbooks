// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"go/parser"
	"go/token"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestPackagePurity asserts that no .go file under server/report directly
// imports server/app, pluginapi, or net/http. This enforces plan §3.6.7
// (resolver layering — pre-resolution table) at the source level.
//
// Note: maroto v2 transitively pulls net/http via pdfcpu/pkg/api — that's
// unavoidable. What this test prevents is a future commit accidentally
// adding a direct import that would let arbitrary I/O escape the
// renderer's trust boundary.
func TestPackagePurity(t *testing.T) {
	root := "."

	forbidden := []string{
		"github.com/mattermost/mattermost-plugin-playbooks/server/app",
		"github.com/mattermost/mattermost/server/public/pluginapi",
		"net/http",
	}

	files, err := filepath.Glob(filepath.Join(root, "**/*.go"))
	require.NoError(t, err)

	roots, err := filepath.Glob(filepath.Join(root, "*.go"))
	require.NoError(t, err)
	files = append(files, roots...)

	mdFiles, err := filepath.Glob(filepath.Join(root, "markdown/*.go"))
	require.NoError(t, err)
	mmFiles, err := filepath.Glob(filepath.Join(root, "markdown/mattermost/*.go"))
	require.NoError(t, err)
	coreFiles, err := filepath.Glob(filepath.Join(root, "coretypes/*.go"))
	require.NoError(t, err)
	files = append(files, mdFiles...)
	files = append(files, mmFiles...)
	files = append(files, coreFiles...)

	fset := token.NewFileSet()
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		src, err := parser.ParseFile(fset, f, nil, parser.ImportsOnly)
		require.NoError(t, err, "parsing %s", f)
		for _, imp := range src.Imports {
			path := strings.Trim(imp.Path.Value, `"`)
			for _, bad := range forbidden {
				require.NotEqualf(t, bad, path,
					"%s directly imports forbidden path %q — plan §3.6.7 violation", f, bad)
			}
		}
	}
}
