// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// teamPlaybookWSEvents announce a playbook to its whole team from playbook_service.go. They
// carry no run data, so they are the only sends allowed outside PublishRunEventToViewers.
var teamPlaybookWSEvents = map[string]bool{
	"playbookCreatedWSEvent":  true,
	"playbookArchivedWSEvent": true,
	"playbookRestoredWSEvent": true,
}

// TestWebsocketSendsGoThroughPublishRunEventToViewers fails when code in this package calls the
// poster's PublishWebsocketEventTo* methods directly. A run's channel members are not
// necessarily allowed to view the run, so a direct channel or user send can leak run data that
// the REST API would refuse; PublishRunEventToViewers applies the same view check instead.
func TestWebsocketSendsGoThroughPublishRunEventToViewers(t *testing.T) {
	paths, err := filepath.Glob("*.go")
	require.NoError(t, err)

	fset := token.NewFileSet()
	var violations []string
	viewerFilterSends := 0

	for _, path := range paths {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}

		file, err := parser.ParseFile(fset, path, nil, 0)
		require.NoError(t, err)

		for _, decl := range file.Decls {
			enclosing := ""
			if fn, ok := decl.(*ast.FuncDecl); ok {
				enclosing = fn.Name.Name
			}

			allowed := make(map[*ast.SelectorExpr]bool)
			ast.Inspect(decl, func(node ast.Node) bool {
				switch node := node.(type) {
				case *ast.CallExpr:
					sel, ok := node.Fun.(*ast.SelectorExpr)
					if !ok || !isPosterWebsocketSend(sel) {
						return true
					}
					if enclosing == "PublishRunEventToViewers" {
						allowed[sel] = true
						viewerFilterSends++
					} else if path == "playbook_service.go" && len(node.Args) > 0 && isTeamPlaybookWSEvent(node.Args[0]) {
						allowed[sel] = true
					}
				case *ast.SelectorExpr:
					// Reached after the enclosing CallExpr, so this also catches method values
					// such as `send := s.poster.PublishWebsocketEventToUser`.
					if isPosterWebsocketSend(node) && !allowed[node] {
						violations = append(violations, fset.Position(node.Sel.Pos()).String()+": "+node.Sel.Name)
					}
				}
				return true
			})
		}
	}

	require.NotZero(t, viewerFilterSends, "found no websocket sends in PublishRunEventToViewers, so this guard is not parsing the package it protects")
	assert.Empty(t, violations,
		"run websocket events must be sent with PublishRunEventToViewers(event, payload, run, additionalUserIDs...), "+
			"which only delivers to users allowed to view the run; calling the poster directly bypasses that check. "+
			"Team-level playbook events belong in teamPlaybookWSEvents.")
}

func isPosterWebsocketSend(sel *ast.SelectorExpr) bool {
	return strings.HasPrefix(sel.Sel.Name, "PublishWebsocketEventTo")
}

func isTeamPlaybookWSEvent(arg ast.Expr) bool {
	ident, ok := arg.(*ast.Ident)
	return ok && teamPlaybookWSEvents[ident.Name]
}
