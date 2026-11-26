// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html_writer //nolint:staticcheck

import (
	"bytes"
	"html/template"
	"strings"
	"unicode"

	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
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
// Mattermost-specific rendering (mentions, channel links, emoji) is not
// supported; those stay as plain text.
func markdownToHTML(md string) template.HTML {
	if strings.TrimSpace(md) == "" {
		return ""
	}
	// Leading spaces can start an indented code block, so only trailing
	// whitespace is trimmed.
	src := strings.TrimRightFunc(md, unicode.IsSpace)

	var buf bytes.Buffer
	if err := markdown.Convert([]byte(src), &buf); err != nil {
		// Goldmark conversion errors are exceedingly rare for in-memory
		// input. Fall back to escaped plain text rather than propagating
		// the error to the caller — the report should still render.
		return template.HTML(template.HTMLEscapeString(src)) //nolint:gosec
	}

	return template.HTML(sanitizer.SanitizeBytes(buf.Bytes())) //nolint:gosec
}

// markdown and sanitizer are built once: both are safe for concurrent use,
// and building them costs far more than converting a message.
var (
	markdown = goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			// Note: NOT html.WithUnsafe() — raw HTML stays escaped.
			html.WithHardWraps(),
		),
	)
	sanitizer = htmlSanitizerPolicy()
)

// htmlSanitizerPolicy returns the bluemonday policy used to scrub goldmark
// output before it lands in a template. UGCPolicy is the well-known
// permissive-but-safe baseline for user-generated content; we tighten it
// slightly by re-asserting the allowed URL schemes: http / https / mailto
// only.
func htmlSanitizerPolicy() *bluemonday.Policy {
	p := bluemonday.UGCPolicy()
	p.AllowURLSchemes("http", "https", "mailto")
	// Allow class on a/code/span so syntax-highlighted code blocks and
	// inline marks survive — bluemonday strips all attributes by default
	// except the few each rule grants.
	p.AllowAttrs("class").OnElements("a", "code", "pre", "span", "div")
	return p
}
