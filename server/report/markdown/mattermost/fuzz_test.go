// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mattermost

import (
	"strings"
	"testing"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/text"
)

// fuzzParse drives the Mattermost inline parsers under the goldmark parser
// to confirm no input triggers a panic or unbounded allocation. The output
// is intentionally discarded — the fuzz target's only invariant is "must
// not panic".
func fuzzParse(t fuzzT, src string) {
	t.Helper()
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("parser panicked on %q: %v", src, r)
		}
	}()
	md := goldmark.New(goldmark.WithExtensions(Extension))
	_ = md.Parser().Parse(text.NewReader([]byte(src)))
}

type fuzzT interface {
	Helper()
	Errorf(format string, args ...any)
}

// FuzzMention exercises the mention parser by prepending `@` to the input.
func FuzzMention(f *testing.F) {
	f.Add("alice")
	f.Add("here")
	f.Add("channel")
	f.Add("all")
	f.Add("alice.bob-carol_42")
	f.Add(strings.Repeat("a", MaxMentionLen))
	f.Add(strings.Repeat("a", MaxMentionLen+200))
	f.Add("")
	f.Fuzz(func(t *testing.T, s string) {
		fuzzParse(t, "@"+s+" tail")
	})
}

// FuzzChannelLink exercises the channel-link parser by prepending `~`.
func FuzzChannelLink(f *testing.F) {
	f.Add("ops")
	f.Add("town-square")
	f.Add(strings.Repeat("c", MaxChannelLinkLen))
	f.Add(strings.Repeat("c", MaxChannelLinkLen+200))
	f.Add("")
	f.Fuzz(func(t *testing.T, s string) {
		fuzzParse(t, "~"+s+" tail")
	})
}

// FuzzEmojiText exercises the emoji parser by wrapping in colons.
func FuzzEmojiText(f *testing.F) {
	f.Add("rocket")
	f.Add("tada")
	f.Add(strings.Repeat("e", MaxEmojiShortcodeLen))
	f.Add(strings.Repeat("e", MaxEmojiShortcodeLen+10))
	f.Add("")
	f.Add("not_terminated")
	f.Fuzz(func(t *testing.T, s string) {
		fuzzParse(t, ":"+s+":")
	})
}

// FuzzAnyInput drives the parser with completely arbitrary text — this is
// the catch-all for surprising interactions between the three parsers and
// the standard goldmark inline rules.
func FuzzAnyInput(f *testing.F) {
	f.Add("plain text")
	f.Add("@alice ~ops :rocket: link[a](http://x)")
	f.Add("\x00\x01\x02@~::::@@@@~~~")
	f.Fuzz(func(t *testing.T, s string) {
		fuzzParse(t, s)
	})
}
