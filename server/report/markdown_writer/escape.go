// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer //nolint:staticcheck

import (
	"bytes"
	"regexp"
	"slices"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
)

var (
	newlineReplacer = strings.NewReplacer("\r\n", " ", "\n", " ", "\r", " ")
	markdownEscaper = strings.NewReplacer(
		`\`, `\\`, "`", "\\`", "*", `\*`, "_", `\_`, "[", `\[`, "]", `\]`, "<", `\<`, ">", `\>`,
		"#", `\#`, "|", `\|`, "~", `\~`, "!", `\!`, "&", `\&`,
	)

	// verbatimRe matches bare URLs, which a backslash escape would break, and @mentions, which
	// a backslash escape would not stop from notifying when pasted into Mattermost. A mention
	// includes any underscores right before it, which Mattermost strips before looking for one,
	// and any mention run into it, such as @here in @all@here.
	verbatimRe = regexp.MustCompile(`https?://[A-Za-z0-9\-._~:/?#!$&'+,;=%@]+|(?:\B|\b_+)@[A-Za-z0-9_](?:[A-Za-z0-9_.\-@]*[A-Za-z0-9_])?`)
)

// escapeText makes plain text, such as a run name, render as the literal text it is, on one
// line, wherever it is placed. Bare URLs and @mentions are left as they are; inertMentions
// deals with mentions once the whole document is written.
func escapeText(s string) string {
	s = strings.TrimSpace(newlineReplacer.Replace(s))

	var b strings.Builder
	last := 0
	for _, match := range verbatimRe.FindAllStringIndex(s, -1) {
		b.WriteString(markdownEscaper.Replace(s[last:match[0]]))
		b.WriteString(s[match[0]:match[1]])
		last = match[1]
	}
	b.WriteString(markdownEscaper.Replace(s[last:]))

	s = b.String()
	if s == "" {
		return s
	}

	// A leading "-" or "+" would start a list or a thematic break, and "1. " or "1) " an ordered list.
	if s[0] == '-' || s[0] == '+' {
		return `\` + s
	}
	digits := strings.IndexFunc(s, func(r rune) bool { return r < '0' || r > '9' })
	if digits > 0 && (s[digits] == '.' || s[digits] == ')') && (len(s) == digits+1 || s[digits+1] == ' ') {
		return s[:digits] + `\` + s[digits:]
	}
	return s
}

// inertMentions puts every @mention in md, and every bare URL containing an @, in a code span,
// so pasting the report into Mattermost notifies no one. Mattermost ignores mentions in code,
// so code spans and code blocks are left alone.
func inertMentions(md []byte) []byte {
	doc := goldmark.DefaultParser().Parse(text.NewReader(md))

	// Collect the source ranges of the document's text. goldmark splits text at characters
	// such as "_" and drops the ones it reads as emphasis, so ranges separated by nothing but
	// emphasis delimiters are merged to keep a mention like @john_doe or @_john_ whole.
	var ranges []text.Segment
	add := func(seg text.Segment) {
		if n := len(ranges); n > 0 && ranges[n-1].Stop <= seg.Start &&
			strings.Trim(string(md[ranges[n-1].Stop:seg.Start]), "_*") == "" {
			ranges[n-1].Stop = seg.Stop
			return
		}
		ranges = append(ranges, seg)
	}
	_ = ast.Walk(doc, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch n := n.(type) {
		case *ast.CodeSpan, *ast.CodeBlock, *ast.FencedCodeBlock, *ast.AutoLink:
			return ast.WalkSkipChildren, nil
		case *ast.Text:
			add(n.Segment)
		case *ast.RawHTML:
			// Mattermost doesn't render HTML, so it reads it as text.
			for i := range n.Segments.Len() {
				add(n.Segments.At(i))
			}
		case *ast.HTMLBlock:
			for i := range n.Lines().Len() {
				add(n.Lines().At(i))
			}
			if n.HasClosure() {
				add(n.ClosureLine)
			}
		}
		return ast.WalkContinue, nil
	})

	type replacement struct{ start, stop int }
	var wraps []replacement
	for _, r := range ranges {
		for _, m := range verbatimRe.FindAllIndex(md[r.Start:r.Stop], -1) {
			if slices.Contains(md[r.Start+m[0]:r.Start+m[1]], '@') {
				start := r.Start + m[0]
				// A backslash escaping the "@" would escape the opening backtick
				// instead, so it goes inside the code span.
				if backslashes := start - len(bytes.TrimRight(md[:start], `\`)); backslashes%2 == 1 {
					start--
				}
				wraps = append(wraps, replacement{start, r.Start + m[1]})
			}
		}
	}
	if len(wraps) == 0 {
		return md
	}
	slices.SortFunc(wraps, func(a, b replacement) int { return a.start - b.start })

	out := make([]byte, 0, len(md)+2*len(wraps))
	last := 0
	for _, w := range wraps {
		out = append(out, md[last:w.start]...)
		out = append(out, '`')
		out = append(out, md[w.start:w.stop]...)
		out = append(out, '`')
		last = w.stop
	}
	return append(out, md[last:]...)
}
