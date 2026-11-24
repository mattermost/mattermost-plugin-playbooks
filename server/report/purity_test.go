// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestPackagePurity asserts that no .go file under server/report directly
// imports server/app, pluginapi, or net/http. This enforces plan §3.6.7
// (resolver layering — pre-resolution table) at the source level, so a
// future commit can't add a direct import that would let arbitrary I/O
// escape the renderer's trust boundary.
func TestPackagePurity(t *testing.T) {
	root := "."

	forbidden := []string{
		"github.com/mattermost/mattermost-plugin-playbooks/server/app",
		"github.com/mattermost/mattermost/server/public/pluginapi",
		"net/http",
	}

	var files []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, "_test.go") {
			files = append(files, path)
		}
		return nil
	})
	require.NoError(t, err)
	require.NotEmpty(t, files)

	fset := token.NewFileSet()
	for _, f := range files {
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
