// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html_writer

import (
	"bytes"
	"html/template"
	"strings"

	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// markdownToHTML converts a Mattermost-flavored markdown string to sanitized
// HTML for embedding in a report.
//
// Defense-in-depth:
//  1. goldmark is configured WITHOUT WithUnsafe() / WithXHTML(). Raw HTML
//     blocks and inline RawHTML are rendered as escaped text rather than
//     interpreted markup.
//  2. The output is then passed through bluemonday's UGCPolicy, which
//     allow-lists a small set of safe tags (a, strong, em, code, pre, ul,
//     ol, li, blockquote, h1-h6, p, br, hr, etc.) and strips every unsafe
//     attribute (onerror, onclick, style, etc.) and dangerous URL schemes
//     on href/src (only http, https, mailto survive on links).
//
// Phase C deliberately uses plain goldmark + GFM rather than the
// Mattermost-flavored extension at server/report/markdown. That extension
// emits typed Instruction nodes for the PDF renderer (mentions, channel
// links, emoji) and has no HTML renderer wired in. Standard markdown
// fidelity is sufficient for v1; MM token-to-HTML rendering ships in a
// follow-up (see plan §3.6.6 polish item).
//
// rt is accepted for forward-compatibility with that follow-up; it is
// currently unused.
func markdownToHTML(md string, rt report.ResolverTable) template.HTML {
	_ = rt // reserved for MM-token resolution in a future phase

	src := strings.TrimSpace(md)
	if src == "" {
		return ""
	}

	gm := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			// Note: NOT html.WithUnsafe() — raw HTML stays escaped.
			html.WithHardWraps(),
		),
	)

	var buf bytes.Buffer
	if err := gm.Convert([]byte(src), &buf); err != nil {
		// Goldmark conversion errors are exceedingly rare for in-memory
		// input. Fall back to escaped plain text rather than propagating
		// the error to the caller — the report should still render.
		return template.HTML(template.HTMLEscapeString(src))
	}

	policy := htmlSanitizerPolicy()
	clean := policy.SanitizeBytes(buf.Bytes())
	return template.HTML(clean)
}

// htmlSanitizerPolicy returns the bluemonday policy used to scrub goldmark
// output before it lands in a template. UGCPolicy is the well-known
// permissive-but-safe baseline for user-generated content; we tighten it
// slightly by re-asserting the allowed URL schemes (the same allowlist
// the typed PDF renderer enforces — http / https / mailto only).
func htmlSanitizerPolicy() *bluemonday.Policy {
	p := bluemonday.UGCPolicy()
	p.AllowURLSchemes("http", "https", "mailto")
	// Allow class on a/code/span so syntax-highlighted code blocks and
	// inline marks survive — bluemonday strips all attributes by default
	// except the few each rule grants.
	p.AllowAttrs("class").OnElements("a", "code", "pre", "span", "div")
	return p
}
