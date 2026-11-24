// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown_writer //nolint:staticcheck

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestInertMentions(t *testing.T) {
	cases := []struct {
		name, in, want string
	}{
		{"plain mention", "hi @alice\n", "hi `@alice`\n"},
		{"special mentions", "@channel and @here\n", "`@channel` and `@here`\n"},
		{"underscore username", "ping @john_doe now\n", "ping `@john_doe` now\n"},
		{"mention read as emphasis", "@_redacted_user_ left\n", "`@_redacted_user_` left\n"},
		{"inside bold", "> **@bob** — 22:18\n", "> **`@bob`** — 22:18\n"},
		{"inside link text", "[@alice](https://example.com)\n", "[`@alice`](https://example.com)\n"},
		{"link destination untouched", "[docs](https://example.com/@alice)\n", "[docs](https://example.com/@alice)\n"},
		{"email untouched", "mail alice@example.com\n", "mail alice@example.com\n"},
		{"bare URL with @", "see https://example.com/@alice\n", "see `https://example.com/@alice`\n"},
		{"bare URL without @", "see https://example.com/a_b\n", "see https://example.com/a_b\n"},
		{"code span untouched", "run `@alice` now\n", "run `@alice` now\n"},
		{"fenced code untouched", "```\n@alice\n```\n", "```\n@alice\n```\n"},
		{"indented code untouched", "    @alice\n", "    @alice\n"},
		{"html block", "<div>\n@all\n</div>\n", "<div>\n`@all`\n</div>\n"},
		{"inline html", "<b>@all</b>\n", "<b>`@all`</b>\n"},
		{"list and heading", "## @alice — x\n\n- [ ] task for @bob\n", "## `@alice` — x\n\n- [ ] task for `@bob`\n"},
		{"no mentions", "# Title\n\nbody\n", "# Title\n\nbody\n"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, string(inertMentions([]byte(tc.in))))
		})
	}
}

func TestEscapeText(t *testing.T) {
	cases := []struct {
		name, in, want string
	}{
		{"plain", "Database outage", "Database outage"},
		{"markdown characters", "*bold* _it_ [x] `c` <b>", `\*bold\* \_it\_ \[x\] \` + "`" + `c\` + "`" + ` \<b\>`},
		{"heading marker", "# not a heading", `\# not a heading`},
		{"list marker", "- not a list", `\- not a list`},
		{"ordered list marker", "1. not a list", `1\. not a list`},
		{"newlines collapse", "one\ntwo\r\nthree", "one two three"},
		{"URL kept", "see https://example.com/a_b", "see https://example.com/a_b"},
		{"mention kept for inertMentions", "owner @john_doe", "owner @john_doe"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, escapeText(tc.in))
		})
	}
}

func TestCloseFences(t *testing.T) {
	cases := []struct {
		name, in, want string
	}{
		{"no fence", "hello", "hello"},
		{"closed fence", "```\ncode\n```", "```\ncode\n```"},
		{"open backtick fence", "```go\ncode", "```go\ncode\n```"},
		{"open tilde fence", "~~~~\ncode\n~~~", "~~~~\ncode\n~~~\n~~~~"},
		{"longer closing fence", "```\ncode\n`````", "```\ncode\n`````"},
		{"other fence char does not close", "```\n~~~", "```\n~~~\n```"},
		{"closing fence with info string does not close", "```\n``` go", "```\n``` go\n```"},
		{"inline code is not a fence", "```a` b", "```a` b"},
		{"indented code is not a fence", "    ```", "    ```"},
		{"two fences", "```\na\n```\n~~~\nb", "```\na\n```\n~~~\nb\n~~~"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, closeFences(tc.in))
		})
	}
}
