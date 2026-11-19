// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"fmt"

	"github.com/pkg/errors"
)

const (
	// maxGraphQLQueryLength bounds the query document. The largest document the webapp sends is
	// about 5 KB; checklists in updatePlaybook travel in variables, which this does not count.
	maxGraphQLQueryLength = 32 * 1024

	// maxRootFieldKeys bounds how many response keys may resolve the same root field. Root
	// lookups each hydrate a record, and the webapp asks for at most two of the same kind.
	maxRootFieldKeys = 3

	// maxNestedFieldKeys bounds how many response keys may resolve the same nested field. Every
	// alias of a field resolves it again, so one key is all a client needs below the root.
	maxNestedFieldKeys = 1

	// maxQueryFieldSelections and maxQuerySelectionDepth bound the walk itself, so that
	// fragments spread at every level cannot expand into more work than the query shows.
	maxQueryFieldSelections = 2000
	maxQuerySelectionDepth  = 16
)

// checkGraphQLQueryLimits rejects documents that would resolve the same field under several
// response keys, which multiplies resolver and response cost without growing the request.
// It runs before execution and fails closed: anything it cannot parse is rejected.
func checkGraphQLQueryLimits(query string) error {
	if len(query) > maxGraphQLQueryLength {
		return errors.Errorf("query exceeds the maximum length of %d bytes", maxGraphQLQueryLength)
	}

	doc, err := parseGraphQLDocument(query)
	if err != nil {
		return errors.Wrap(err, "unable to parse query")
	}

	checker := &queryLimitChecker{fragments: doc.fragments}
	for _, operation := range doc.operations {
		if err := checker.checkSelectionSets([][]gqlSelection{operation}, 0); err != nil {
			return err
		}
	}

	return nil
}

type queryLimitChecker struct {
	fragments  map[string][]gqlSelection
	selections int
}

type fieldGroup struct {
	name     string
	children [][]gqlSelection
}

// checkSelectionSets checks the merged selection sets of one response object: the same response
// key requested in several places, including through fragments, resolves once with the union of
// its sub-selections, so those are checked together one level down.
func (c *queryLimitChecker) checkSelectionSets(sets [][]gqlSelection, depth int) error {
	if depth > maxQuerySelectionDepth {
		return errors.Errorf("query exceeds the maximum selection depth of %d", maxQuerySelectionDepth)
	}

	groups := map[string]*fieldGroup{}
	var keys []string
	visitedFragments := map[string]bool{}
	if err := c.collectFields(sets, groups, &keys, visitedFragments, map[string]bool{}); err != nil {
		return err
	}

	limit := maxNestedFieldKeys
	if depth == 0 {
		limit = maxRootFieldKeys
	}
	keysPerField := map[string]int{}
	for _, key := range keys {
		name := groups[key].name
		keysPerField[name]++
		if keysPerField[name] > limit {
			return errors.Errorf("query requests the field %q more than %d %s", name, limit, pluralTimes(limit))
		}
	}

	for _, key := range keys {
		if children := groups[key].children; len(children) > 0 {
			if err := c.checkSelectionSets(children, depth+1); err != nil {
				return err
			}
		}
	}

	return nil
}

func (c *queryLimitChecker) collectFields(sets [][]gqlSelection, groups map[string]*fieldGroup, keys *[]string, visited, expanding map[string]bool) error {
	for _, set := range sets {
		for _, selection := range set {
			switch {
			case selection.field != nil:
				c.selections++
				if c.selections > maxQueryFieldSelections {
					return errors.Errorf("query exceeds the maximum of %d field selections", maxQueryFieldSelections)
				}

				field := selection.field
				group, ok := groups[field.key]
				if !ok {
					group = &fieldGroup{name: field.name}
					groups[field.key] = group
					*keys = append(*keys, field.key)
				} else if group.name != field.name {
					return errors.Errorf("response key %q is used for different fields", field.key)
				}
				if len(field.children) > 0 {
					group.children = append(group.children, field.children)
				}

			case selection.spread != "":
				name := selection.spread
				if expanding[name] {
					return errors.Errorf("fragment %q spreads itself", name)
				}
				if visited[name] {
					continue
				}
				fragment, ok := c.fragments[name]
				if !ok {
					return errors.Errorf("unknown fragment %q", name)
				}
				visited[name] = true
				expanding[name] = true
				if err := c.collectFields([][]gqlSelection{fragment}, groups, keys, visited, expanding); err != nil {
					return err
				}
				delete(expanding, name)

			default:
				if err := c.collectFields([][]gqlSelection{selection.inline}, groups, keys, visited, expanding); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func pluralTimes(n int) string {
	if n == 1 {
		return "time"
	}
	return "times"
}

// gqlSelection is one entry of a selection set: a field, a fragment spread or an inline fragment.
type gqlSelection struct {
	field  *gqlField
	spread string
	inline []gqlSelection
}

type gqlField struct {
	name     string
	key      string
	children []gqlSelection
}

type gqlDocument struct {
	operations [][]gqlSelection
	fragments  map[string][]gqlSelection
}

// parseGraphQLDocument reads only what the limit check needs: operations, fragment definitions and
// their selection sets. Arguments, variable definitions and directives are skipped, since the
// schema validates them during execution.
func parseGraphQLDocument(query string) (*gqlDocument, error) {
	p := &gqlParser{lexer: gqlLexer{src: query}}
	if err := p.advance(); err != nil {
		return nil, err
	}

	doc := &gqlDocument{fragments: map[string][]gqlSelection{}}
	for p.tok.kind != tokEOF {
		switch {
		case p.isPunct("{"):
			set, err := p.parseSelectionSet()
			if err != nil {
				return nil, err
			}
			doc.operations = append(doc.operations, set)

		case p.isName("query"), p.isName("mutation"), p.isName("subscription"):
			if err := p.advance(); err != nil {
				return nil, err
			}
			if p.tok.kind == tokName {
				if err := p.advance(); err != nil {
					return nil, err
				}
			}
			if p.isPunct("(") {
				if err := p.skipBalanced("(", ")"); err != nil {
					return nil, err
				}
			}
			if err := p.skipDirectives(); err != nil {
				return nil, err
			}
			set, err := p.parseSelectionSet()
			if err != nil {
				return nil, err
			}
			doc.operations = append(doc.operations, set)

		case p.isName("fragment"):
			if err := p.advance(); err != nil {
				return nil, err
			}
			name, err := p.expectName()
			if err != nil {
				return nil, err
			}
			if _, exists := doc.fragments[name]; exists {
				return nil, errors.Errorf("fragment %q is defined more than once", name)
			}
			if !p.isName("on") {
				return nil, p.unexpected()
			}
			if err = p.advance(); err != nil {
				return nil, err
			}
			if _, err = p.expectName(); err != nil {
				return nil, err
			}
			if err = p.skipDirectives(); err != nil {
				return nil, err
			}
			set, err := p.parseSelectionSet()
			if err != nil {
				return nil, err
			}
			doc.fragments[name] = set

		default:
			return nil, p.unexpected()
		}
	}

	if len(doc.operations) == 0 {
		return nil, errors.New("document has no operation")
	}

	return doc, nil
}

type gqlParser struct {
	lexer gqlLexer
	tok   gqlToken
}

func (p *gqlParser) advance() error {
	tok, err := p.lexer.next()
	if err != nil {
		return err
	}
	p.tok = tok
	return nil
}

func (p *gqlParser) isPunct(value string) bool {
	return p.tok.kind == tokPunct && p.tok.value == value
}

func (p *gqlParser) isName(value string) bool {
	return p.tok.kind == tokName && p.tok.value == value
}

func (p *gqlParser) unexpected() error {
	if p.tok.kind == tokEOF {
		return errors.New("unexpected end of query")
	}
	return errors.Errorf("unexpected %q at offset %d", p.tok.value, p.tok.offset)
}

func (p *gqlParser) expectName() (string, error) {
	if p.tok.kind != tokName {
		return "", p.unexpected()
	}
	name := p.tok.value
	return name, p.advance()
}

func (p *gqlParser) expectPunct(value string) error {
	if !p.isPunct(value) {
		return p.unexpected()
	}
	return p.advance()
}

func (p *gqlParser) parseSelectionSet() ([]gqlSelection, error) {
	if err := p.expectPunct("{"); err != nil {
		return nil, err
	}

	var set []gqlSelection
	for !p.isPunct("}") {
		selection, err := p.parseSelection()
		if err != nil {
			return nil, err
		}
		set = append(set, selection)
	}
	if len(set) == 0 {
		return nil, errors.New("empty selection set")
	}

	return set, p.advance()
}

func (p *gqlParser) parseSelection() (gqlSelection, error) {
	if p.isPunct("...") {
		if err := p.advance(); err != nil {
			return gqlSelection{}, err
		}

		if p.tok.kind == tokName && p.tok.value != "on" {
			name := p.tok.value
			if err := p.advance(); err != nil {
				return gqlSelection{}, err
			}
			return gqlSelection{spread: name}, p.skipDirectives()
		}

		if p.isName("on") {
			if err := p.advance(); err != nil {
				return gqlSelection{}, err
			}
			if _, err := p.expectName(); err != nil {
				return gqlSelection{}, err
			}
		}
		if err := p.skipDirectives(); err != nil {
			return gqlSelection{}, err
		}
		set, err := p.parseSelectionSet()
		return gqlSelection{inline: set}, err
	}

	name, err := p.expectName()
	if err != nil {
		return gqlSelection{}, err
	}
	field := &gqlField{name: name, key: name}
	if p.isPunct(":") {
		if err = p.advance(); err != nil {
			return gqlSelection{}, err
		}
		if field.name, err = p.expectName(); err != nil {
			return gqlSelection{}, err
		}
	}
	if p.isPunct("(") {
		if err = p.skipBalanced("(", ")"); err != nil {
			return gqlSelection{}, err
		}
	}
	if err = p.skipDirectives(); err != nil {
		return gqlSelection{}, err
	}
	if p.isPunct("{") {
		if field.children, err = p.parseSelectionSet(); err != nil {
			return gqlSelection{}, err
		}
	}

	return gqlSelection{field: field}, nil
}

func (p *gqlParser) skipDirectives() error {
	for p.isPunct("@") {
		if err := p.advance(); err != nil {
			return err
		}
		if _, err := p.expectName(); err != nil {
			return err
		}
		if p.isPunct("(") {
			if err := p.skipBalanced("(", ")"); err != nil {
				return err
			}
		}
	}
	return nil
}

// skipBalanced skips from an opening punctuator to its matching close. Strings are single tokens,
// so delimiters inside argument values cannot unbalance it.
func (p *gqlParser) skipBalanced(open, closing string) error {
	depth := 0
	for {
		switch {
		case p.tok.kind == tokEOF:
			return p.unexpected()
		case p.isPunct(open):
			depth++
		case p.isPunct(closing):
			depth--
		}
		if err := p.advance(); err != nil {
			return err
		}
		if depth == 0 {
			return nil
		}
	}
}

type gqlTokenKind int

const (
	tokEOF gqlTokenKind = iota
	tokName
	tokPunct
	tokValue
)

type gqlToken struct {
	kind   gqlTokenKind
	value  string
	offset int
}

type gqlLexer struct {
	src string
	pos int
}

func (l *gqlLexer) next() (gqlToken, error) {
	l.skipIgnored()
	if l.pos >= len(l.src) {
		return gqlToken{kind: tokEOF, offset: l.pos}, nil
	}

	start := l.pos
	ch := l.src[l.pos]
	switch {
	case isNameStart(ch):
		for l.pos < len(l.src) && isNameContinue(l.src[l.pos]) {
			l.pos++
		}
		return gqlToken{kind: tokName, value: l.src[start:l.pos], offset: start}, nil

	case ch == '-' || isDigit(ch):
		l.pos++
		for l.pos < len(l.src) && (isNameContinue(l.src[l.pos]) || l.src[l.pos] == '.' || l.src[l.pos] == '+' || l.src[l.pos] == '-') {
			l.pos++
		}
		return gqlToken{kind: tokValue, value: l.src[start:l.pos], offset: start}, nil

	case ch == '"':
		if err := l.skipString(); err != nil {
			return gqlToken{}, err
		}
		return gqlToken{kind: tokValue, value: `""`, offset: start}, nil

	case ch == '.':
		if len(l.src)-l.pos >= 3 && l.src[l.pos:l.pos+3] == "..." {
			l.pos += 3
			return gqlToken{kind: tokPunct, value: "...", offset: start}, nil
		}

	case ch == '!' || ch == '$' || ch == '&' || ch == '(' || ch == ')' || ch == ':' || ch == '=' ||
		ch == '@' || ch == '[' || ch == ']' || ch == '{' || ch == '|' || ch == '}':
		l.pos++
		return gqlToken{kind: tokPunct, value: string(ch), offset: start}, nil
	}

	return gqlToken{}, fmt.Errorf("unexpected character %q at offset %d", ch, start)
}

func (l *gqlLexer) skipIgnored() {
	for l.pos < len(l.src) {
		switch ch := l.src[l.pos]; {
		case ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' || ch == ',':
			l.pos++
		case ch == '#':
			for l.pos < len(l.src) && l.src[l.pos] != '\n' && l.src[l.pos] != '\r' {
				l.pos++
			}
		case len(l.src)-l.pos >= 3 && l.src[l.pos:l.pos+3] == "\uFEFF":
			l.pos += 3
		default:
			return
		}
	}
}

func (l *gqlLexer) skipString() error {
	start := l.pos
	if len(l.src)-l.pos >= 3 && l.src[l.pos:l.pos+3] == `"""` {
		l.pos += 3
		for l.pos < len(l.src) {
			switch {
			case len(l.src)-l.pos >= 4 && l.src[l.pos:l.pos+4] == `\"""`:
				l.pos += 4
			case len(l.src)-l.pos >= 3 && l.src[l.pos:l.pos+3] == `"""`:
				l.pos += 3
				return nil
			default:
				l.pos++
			}
		}
		return errors.Errorf("unterminated string at offset %d", start)
	}

	l.pos++
	for l.pos < len(l.src) {
		switch l.src[l.pos] {
		case '\\':
			l.pos += 2
		case '"':
			l.pos++
			return nil
		case '\n', '\r':
			return errors.Errorf("unterminated string at offset %d", start)
		default:
			l.pos++
		}
	}
	return errors.Errorf("unterminated string at offset %d", start)
}

func isNameStart(ch byte) bool {
	return ch == '_' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
}

func isNameContinue(ch byte) bool {
	return isNameStart(ch) || isDigit(ch)
}

func isDigit(ch byte) bool {
	return ch >= '0' && ch <= '9'
}
