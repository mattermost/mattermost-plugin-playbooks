// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// webappDocuments reads every document the webapp can send, from the generated client and from
// inline gql templates, appending all fragments to each operation as the client does.
func webappDocuments(t *testing.T) map[string]string {
	t.Helper()

	source, err := os.ReadFile("../../webapp/src/graphql/generated/gql.ts")
	require.NoError(t, err)

	block := regexp.MustCompile(`(?s)const documents = \{\n(.*?)\n\};`).FindSubmatch(source)
	require.NotNil(t, block, "documents map not found in gql.ts")

	entry := regexp.MustCompile(`(?m)^\s*("(?:[^"\\]|\\.)*"): types\.\w+,?$`)
	var operations, fragments []string
	for _, match := range entry.FindAllSubmatch(block[1], -1) {
		document, err := strconv.Unquote(string(match[1]))
		require.NoError(t, err)

		if strings.HasPrefix(strings.TrimSpace(document), "fragment ") {
			fragments = append(fragments, document)
		} else {
			operations = append(operations, document)
		}
	}
	require.NotEmpty(t, operations)

	inline := regexp.MustCompile("(?s)gql`(.*?)`")
	err = filepath.WalkDir("../../webapp/src", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || strings.Contains(path, "generated") || !strings.HasSuffix(path, ".ts") && !strings.HasSuffix(path, ".tsx") {
			return err
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, match := range inline.FindAllSubmatch(content, -1) {
			operations = append(operations, string(match[1]))
		}
		return nil
	})
	require.NoError(t, err)

	documents := map[string]string{}
	name := regexp.MustCompile(`(?:query|mutation)\s+(\w+)`)
	for _, operation := range operations {
		match := name.FindStringSubmatch(operation)
		require.NotNil(t, match, "operation without a name: %s", operation)
		documents[match[1]] = operation + strings.Join(fragments, "\n")
	}

	return documents
}

func repeated(format string, n int) string {
	var b strings.Builder
	for i := range n {
		fmt.Fprintf(&b, format+"\n", i)
	}
	return b.String()
}

func TestCheckGraphQLQueryLimitsAllowsWebappDocuments(t *testing.T) {
	documents := webappDocuments(t)
	require.Greater(t, len(documents), 5, "expected to find the webapp's operations")

	for name, document := range documents {
		t.Run(name, func(t *testing.T) {
			assert.NoError(t, checkGraphQLQueryLimits(document))
		})
	}
}

func TestCheckGraphQLQueryLimitsRejectsRepeatedFields(t *testing.T) {
	const runID = "abcdefghijklmnopqrstuvwxyz"

	for name, tc := range map[string]struct {
		query string
		want  string
	}{
		"a run text field under many aliases": {
			query: `query Probe { run(id: "` + runID + `") { ` + repeated("a%d: retrospective", 700) + ` } }`,
			want:  `"retrospective" more than 1 time`,
		},
		"followers under two aliases": {
			query: `query Probe { run(id: "` + runID + `") { followers again: followers } }`,
			want:  `"followers" more than 1 time`,
		},
		"property fields under two aliases": {
			query: `query Probe { run(id: "` + runID + `") { a: propertyFields { id } b: propertyFields { id } } }`,
			want:  `"propertyFields" more than 1 time`,
		},
		"the run summary under many aliases": {
			query: `query Probe { run(id: "` + runID + `") { ` + repeated("a%d: summary", 700) + ` } }`,
			want:  `"summary" more than 1 time`,
		},
		"playbook property fields under two aliases": {
			query: `query Probe { playbook(id: "` + runID + `") { a: propertyFields { id } b: propertyFields { id } } }`,
			want:  `"propertyFields" more than 1 time`,
		},
		"root playbook property lookups beyond the root limit": {
			query: `query Probe { ` + repeated(`a%d: playbookProperty(playbookID: "`+runID+`", propertyID: "`+runID+`") { id }`, 4) + ` }`,
			want:  `"playbookProperty" more than 3 times`,
		},
		"playbook checklists under many aliases": {
			query: `query Probe { playbook(id: "` + runID + `") { ` + repeated("a%d: checklists { items { description } }", 150) + ` } }`,
			want:  `"checklists" more than 1 time`,
		},
		"the playbook description under many aliases": {
			query: `query Probe { playbook(id: "` + runID + `") { ` + repeated("a%d: description", 700) + ` } }`,
			want:  `"description" more than 1 time`,
		},
		"run checklists under many aliases": {
			query: `query Probe { run(id: "` + runID + `") { ` + repeated("a%d: checklists { items { description } }", 150) + ` } }`,
			want:  `"checklists" more than 1 time`,
		},
		"a field repeated deeper in the tree": {
			query: `query Probe { run(id: "` + runID + `") { checklists { items { a: description b: description } } } }`,
			want:  `"description" more than 1 time`,
		},
		"root run lookups beyond the root limit": {
			query: `query Probe { ` + repeated(`a%d: run(id: "`+runID+`") { id }`, 4) + ` }`,
			want:  `"run" more than 3 times`,
		},
		"root playbook lookups for hundreds of ids": {
			query: `query Probe { ` + repeated(`a%d: playbook(id: "`+runID+`") { id }`, 500) + ` }`,
			want:  `"playbook" more than 3 times`,
		},
		"root mutations beyond the root limit": {
			query: `mutation Probe { ` + repeated(`a%d: setRunFavorite(id: "`+runID+`", fav: true)`, 4) + ` }`,
			want:  `"setRunFavorite" more than 3 times`,
		},
		"aliases stacked through a fragment": {
			query: `query Probe { ` + repeated(`r%d: run(id: "`+runID+`") { ...F }`, 3) + ` }
				fragment F on Run { ` + repeated("a%d: followers", 20) + ` }`,
			want: `"followers" more than 1 time`,
		},
		"aliases split across two fragments": {
			query: `query Probe { run(id: "` + runID + `") { ...F ...G } }
				fragment F on Run { a: followers }
				fragment G on Run { b: followers }`,
			want: `"followers" more than 1 time`,
		},
		"aliases split across an inline fragment": {
			query: `query Probe { run(id: "` + runID + `") { followers ... on Run { again: followers } } }`,
			want:  `"followers" more than 1 time`,
		},
		"aliases split across a directive-only inline fragment": {
			query: `query Probe { run(id: "` + runID + `") { followers ... @include(if: true) { again: followers } } }`,
			want:  `"followers" more than 1 time`,
		},
		"aliases split across two selections of the same root key": {
			query: `query Probe {
				r: run(id: "` + runID + `") { a: followers }
				r: run(id: "` + runID + `") { b: followers }
			}`,
			want: `"followers" more than 1 time`,
		},
		"aliases hidden in an operation that was not named": {
			query: `query Fine { run(id: "` + runID + `") { id } }
				query Probe { run(id: "` + runID + `") { followers again: followers } }`,
			want: `"followers" more than 1 time`,
		},
		"one response key used for two fields": {
			query: `query Probe { run(id: "` + runID + `") { a: name a: summary } }`,
			want:  `response key "a"`,
		},
	} {
		t.Run(name, func(t *testing.T) {
			err := checkGraphQLQueryLimits(tc.query)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.want)
		})
	}
}

func TestCheckGraphQLQueryLimitsAllowsMergedSelections(t *testing.T) {
	const runID = "abcdefghijklmnopqrstuvwxyz"

	for name, query := range map[string]string{
		"the same field twice under one key": `query Q { run(id: "` + runID + `") { id id name } }`,
		"one alias per field":                `query Q { run(id: "` + runID + `") { runName: name summary } }`,
		"the same fragment spread twice":     `query Q { run(id: "` + runID + `") { ...F ...F } } fragment F on Run { followers }`,
		"a fragment and a field with the same key": `query Q { run(id: "` + runID + `") { followers ...F } }
			fragment F on Run { followers }`,
		"three root lookups":                            `query Q { ` + repeated(`a%d: run(id: "`+runID+`") { id }`, 3) + ` }`,
		"the same nested field under different parents": `query Q { run(id: "` + runID + `") { checklists { title items { title } } } }`,
		"punctuation and keywords inside strings":       `query Q { run(id: "{ a: followers b: followers } ... on \" #") { id } }`,
		"comments": "query Q { # a: followers b: followers {\n run(id: \"" + runID + "\") { id } }",
		"variables with defaults and directives": `query Q($id: String! = "x", $flag: Boolean = true) @dir {
			run(id: $id) { id @include(if: $flag) name @skip(if: false) }
		}`,
		"an anonymous query": `{ run(id: "` + runID + `") { id } }`,
	} {
		t.Run(name, func(t *testing.T) {
			assert.NoError(t, checkGraphQLQueryLimits(query))
		})
	}
}

func TestCheckGraphQLQueryLimitsFailsClosed(t *testing.T) {
	for name, tc := range map[string]struct {
		query string
		want  string
	}{
		"an empty document":      {query: "", want: "no operation"},
		"an unterminated string": {query: `query Q { run(id: "abc) { id } }`, want: "unterminated string"},
		"an unterminated block":  {query: `query Q { run(id: "x") { id }`, want: "unexpected end"},
		"an unknown character":   {query: `query Q { run(id: "x") { id; } }`, want: "unexpected character"},
		"a block string":         {query: `query Q { run(id: """x""") { id } }`, want: "block strings are not supported"},
		"aliases hidden by a block string": {
			query: `query Q { run(id: [""" "]) { id } ` + repeated(`a%d: run(id: "x") { id }`, 10) + ` b: run(id: [" """]) { id } }`,
			want:  "block strings are not supported",
		},
		"an unknown fragment":         {query: `query Q { run(id: "x") { ...Missing } }`, want: `unknown fragment "Missing"`},
		"a fragment defined twice":    {query: `query Q { run(id: "x") { ...F } } fragment F on Run { id } fragment F on Run { name }`, want: "defined more than once"},
		"a fragment spreading itself": {query: `query Q { run(id: "x") { ...F } } fragment F on Run { id ...F }`, want: `fragment "F" spreads itself`},
		"fragments spreading each other": {
			query: `query Q { run(id: "x") { ...F } } fragment F on Run { ...G } fragment G on Run { id ...F }`,
			want:  "spreads itself",
		},
		"a fragment cycle through a nested field": {
			query: `query Q { run(id: "x") { ...F } } fragment F on Run { playbook { runs { ...F } } }`,
			want:  `fragment "F" spreads itself`,
		},
		"an over-long query": {
			query: `query Q { run(id: "x") { id } }` + strings.Repeat(" ", maxGraphQLQueryLength),
			want:  "maximum length",
		},
	} {
		t.Run(name, func(t *testing.T) {
			err := checkGraphQLQueryLimits(tc.query)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.want)
		})
	}

	t.Run("fragments that double at every level", func(t *testing.T) {
		// Each fragment uses the next twice under different fields, so the expanded query is
		// 2^n times larger than its text.
		var query strings.Builder
		query.WriteString(`query Q { run(id: "x") { ...F0 } }`)
		for i := range 14 {
			fmt.Fprintf(&query, " fragment F%d on Run { a { ...F%d } b { ...F%d } }", i, i+1, i+1)
		}
		query.WriteString(" fragment F14 on Run { id }")

		err := checkGraphQLQueryLimits(query.String())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "maximum of 2000 field selections")
	})

	t.Run("fragments spread twice on the same object", func(t *testing.T) {
		// Response keys merge, but execution expands each spread separately: 2^24 selections.
		var query strings.Builder
		query.WriteString(`query Q { run(id: "x") { ...F0 } }`)
		for i := range 24 {
			fmt.Fprintf(&query, " fragment F%d on Run { ...F%d ...F%d }", i, i+1, i+1)
		}
		query.WriteString(" fragment F24 on Run { id }")

		err := checkGraphQLQueryLimits(query.String())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "maximum of 2000 field selections")
	})

	t.Run("a fragment spread up to the limit", func(t *testing.T) {
		var query strings.Builder
		query.WriteString(`query Q { run(id: "x") { ...F0 } }`)
		for i := range 9 {
			fmt.Fprintf(&query, " fragment F%d on Run { ...F%d ...F%d }", i, i+1, i+1)
		}
		query.WriteString(" fragment F9 on Run { id name summary }")

		// 1 run + 2^9 * 3 fields = 1537 selections.
		assert.NoError(t, checkGraphQLQueryLimits(query.String()))
	})
}
