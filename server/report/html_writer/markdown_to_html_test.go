// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html_writer

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// emptyResolvers returns an empty but non-nil resolver table for tests that
// don't exercise mention / channel resolution.
func emptyResolvers() report.ResolverTable {
	return report.ResolverTable{
		Users:      map[string]report.RenderUser{},
		Channels:   map[string]report.RenderChannel{},
		Files:      map[string]report.RenderFile{},
		Permalinks: map[string]report.RenderPostPreview{},
	}
}

// TestMarkdownToHTML_XSSCorpus walks a corpus of historically dangerous
// markdown / raw-HTML inputs and verifies the sanitizer leaves no exploit
// vector intact. Each case is a black-box assertion: the output must not
// contain the listed forbidden substrings (case-insensitive where noted).
func TestMarkdownToHTML_XSSCorpus(t *testing.T) {
	cases := []struct {
		name           string
		in             string
		mustNotContain []string // case-insensitive
	}{
		{
			name:           "script tag",
			in:             `<script>alert(1)</script>`,
			mustNotContain: []string{"<script", "</script", "alert(1)"},
		},
		{
			name:           "img onerror",
			in:             `<img src=x onerror=alert(1)>`,
			mustNotContain: []string{"onerror", "alert(1)"},
		},
		{
			name:           "javascript: url in link",
			in:             `[click](javascript:alert(1))`,
			mustNotContain: []string{"javascript:", "alert(1)"},
		},
		{
			name:           "data: url in link",
			in:             `[x](data:text/html,<script>alert(1)</script>)`,
			mustNotContain: []string{"<script", "alert(1)", "data:text/html"},
		},
		{
			name:           "iframe",
			in:             `<iframe src="http://evil.example"></iframe>`,
			mustNotContain: []string{"<iframe", "evil.example"},
		},
		{
			name:           "svg onload",
			in:             `<svg onload=alert(1)>`,
			mustNotContain: []string{"onload", "alert(1)"},
		},
		{
			name:           "object embed",
			in:             `<object data="evil.swf"></object>`,
			mustNotContain: []string{"<object", "evil.swf"},
		},
		{
			name:           "encoded javascript scheme",
			in:             `[x](j&#97;vascript:alert(1))`,
			mustNotContain: []string{"javascript:", "alert(1)"},
		},
		{
			name:           "style with expression",
			in:             `<p style="background:url(javascript:alert(1))">x</p>`,
			mustNotContain: []string{"javascript:", "alert(1)"},
		},
		{
			name:           "html event handler in raw block",
			in:             `<a href="#" onclick="alert(1)">x</a>`,
			mustNotContain: []string{"onclick", "alert(1)"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := string(markdownToHTML(tc.in, emptyResolvers()))
			lower := strings.ToLower(got)
			for _, forbidden := range tc.mustNotContain {
				if strings.Contains(lower, strings.ToLower(forbidden)) {
					t.Fatalf("output contains forbidden substring %q\n--- output ---\n%s", forbidden, got)
				}
			}
		})
	}
}

// TestMarkdownToHTML_PositiveFormatting verifies safe markdown survives the
// sanitizer with the expected HTML tags intact.
func TestMarkdownToHTML_PositiveFormatting(t *testing.T) {
	cases := []struct {
		name        string
		in          string
		mustContain []string
	}{
		{
			name:        "bold and italic",
			in:          `**bold** and _italic_`,
			mustContain: []string{"<strong>bold</strong>", "<em>italic</em>"},
		},
		{
			name:        "inline code",
			in:          "a `snippet` here",
			mustContain: []string{"<code>snippet</code>"},
		},
		{
			name:        "safe link",
			in:          `[example](https://example.com)`,
			mustContain: []string{`href="https://example.com"`, "example</a>"},
		},
		{
			name:        "mailto link",
			in:          `[mail](mailto:a@b.com)`,
			mustContain: []string{`href="mailto:a@b.com"`},
		},
		{
			name:        "unordered list",
			in:          "- one\n- two",
			mustContain: []string{"<ul>", "<li>one</li>", "<li>two</li>"},
		},
		{
			name:        "fenced code block",
			in:          "```\nfoo\n```",
			mustContain: []string{"<pre>", "<code>", "foo"},
		},
		{
			name:        "blockquote",
			in:          "> quoted",
			mustContain: []string{"<blockquote>", "quoted"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := string(markdownToHTML(tc.in, emptyResolvers()))
			for _, want := range tc.mustContain {
				if !strings.Contains(got, want) {
					t.Fatalf("output missing expected substring %q\n--- output ---\n%s", want, got)
				}
			}
		})
	}
}

// TestMarkdownToHTML_EmptyInput verifies trivial inputs render to an empty
// fragment rather than a stray <p></p>.
func TestMarkdownToHTML_EmptyInput(t *testing.T) {
	for _, in := range []string{"", "   ", "\n\n"} {
		got := string(markdownToHTML(in, emptyResolvers()))
		if got != "" {
			t.Fatalf("expected empty output for input %q, got %q", in, got)
		}
	}
}

// TestMarkdownToHTML_ValidUTF8 sanity-checks that the sanitizer never emits
// invalid UTF-8 even for adversarial input.
func TestMarkdownToHTML_ValidUTF8(t *testing.T) {
	inputs := []string{
		"hello world",
		`<script>alert("xss")</script>`,
		"emoji: \xe2\x98\x83 snowman",
	}
	for _, in := range inputs {
		got := []byte(markdownToHTML(in, emptyResolvers()))
		if !utf8.Valid(got) {
			t.Fatalf("non-UTF-8 output for input %q: %x", in, got)
		}
	}
}
