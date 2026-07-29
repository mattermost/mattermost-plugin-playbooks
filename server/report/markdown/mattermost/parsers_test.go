// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mattermost

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/yuin/goldmark"
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
)

func parseAST(t *testing.T, src string) gast.Node {
	t.Helper()
	md := goldmark.New(goldmark.WithExtensions(Extension))
	return md.Parser().Parse(text.NewReader([]byte(src)))
}

func collectMentions(n gast.Node) []*Mention {
	var out []*Mention
	_ = gast.Walk(n, func(node gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}
		if m, ok := node.(*Mention); ok {
			out = append(out, m)
		}
		return gast.WalkContinue, nil
	})
	return out
}

func collectChannelLinks(n gast.Node) []*ChannelLink {
	var out []*ChannelLink
	_ = gast.Walk(n, func(node gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}
		if c, ok := node.(*ChannelLink); ok {
			out = append(out, c)
		}
		return gast.WalkContinue, nil
	})
	return out
}

func collectEmoji(n gast.Node) []*EmojiText {
	var out []*EmojiText
	_ = gast.Walk(n, func(node gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}
		if e, ok := node.(*EmojiText); ok {
			out = append(out, e)
		}
		return gast.WalkContinue, nil
	})
	return out
}

func TestMentionParser(t *testing.T) {
	cases := []struct {
		name   string
		input  string
		expect []struct {
			Name string
			Kind MentionKind
		}
	}{
		{name: "user at start", input: "@alice hello", expect: []struct {
			Name string
			Kind MentionKind
		}{{"alice", MentionUser}}},
		{name: "user after space", input: "ping @bob now", expect: []struct {
			Name string
			Kind MentionKind
		}{{"bob", MentionUser}}},
		{name: "here keyword", input: "@here ack", expect: []struct {
			Name string
			Kind MentionKind
		}{{"here", MentionHere}}},
		{name: "channel keyword", input: "@channel hi", expect: []struct {
			Name string
			Kind MentionKind
		}{{"channel", MentionChannel}}},
		{name: "all keyword", input: "@all hi", expect: []struct {
			Name string
			Kind MentionKind
		}{{"all", MentionAll}}},
		{name: "trailing punctuation stripped", input: "@alice, hi", expect: []struct {
			Name string
			Kind MentionKind
		}{{"alice", MentionUser}}},
		{name: "embedded in word ignored", input: "foo@bar", expect: nil},
		{name: "email-like ignored after letter", input: "alice@example.com", expect: nil},
		{name: "no name after at", input: "@ space", expect: nil},
		{name: "multiple mentions", input: "@alice and @bob", expect: []struct {
			Name string
			Kind MentionKind
		}{{"alice", MentionUser}, {"bob", MentionUser}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ms := collectMentions(parseAST(t, tc.input))
			require.Equal(t, len(tc.expect), len(ms), "input=%q", tc.input)
			for i, m := range ms {
				require.Equal(t, tc.expect[i].Name, m.Name)
				require.Equal(t, tc.expect[i].Kind, m.MentionKind)
			}
		})
	}
}

func TestMentionParser_LengthCap(t *testing.T) {
	long := strings.Repeat("a", MaxMentionLen+50)
	ms := collectMentions(parseAST(t, "@"+long))
	require.Empty(t, ms, "mention longer than %d chars must be rejected", MaxMentionLen)

	atLimit := strings.Repeat("b", MaxMentionLen)
	ms = collectMentions(parseAST(t, "@"+atLimit+" tail"))
	require.Len(t, ms, 1)
	require.Equal(t, atLimit, ms[0].Name)
}

func TestChannelLinkParser(t *testing.T) {
	cases := []struct {
		name   string
		input  string
		expect []string
	}{
		{name: "channel at start", input: "~ops-room here", expect: []string{"ops-room"}},
		{name: "channel after space", input: "see ~town-square", expect: []string{"town-square"}},
		{name: "trailing punctuation stripped", input: "see ~ops, ok", expect: []string{"ops"}},
		{name: "no name after tilde", input: "~ space", expect: nil},
		{name: "embedded in word ignored", input: "foo~bar", expect: nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cs := collectChannelLinks(parseAST(t, tc.input))
			require.Equal(t, len(tc.expect), len(cs))
			for i, c := range cs {
				require.Equal(t, tc.expect[i], c.Name)
			}
		})
	}
}

func TestChannelLinkParser_LengthCap(t *testing.T) {
	long := strings.Repeat("a", MaxChannelLinkLen+50)
	cs := collectChannelLinks(parseAST(t, "~"+long))
	require.Empty(t, cs)
}

func TestEmojiTextParser(t *testing.T) {
	cases := []struct {
		name   string
		input  string
		expect []string
	}{
		{name: "basic", input: "fire :rocket: now", expect: []string{"rocket"}},
		{name: "multiple", input: ":a: :b:", expect: []string{"a", "b"}},
		{name: "with plus and underscore", input: ":tada_+1:", expect: []string{"tada_+1"}},
		{name: "unterminated", input: ":not_an_emoji", expect: nil},
		{name: "empty", input: "::", expect: nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			es := collectEmoji(parseAST(t, tc.input))
			require.Equal(t, len(tc.expect), len(es), "input=%q", tc.input)
			for i, e := range es {
				require.Equal(t, tc.expect[i], e.Shortcode)
			}
		})
	}
}

func TestEmojiTextParser_LengthCap(t *testing.T) {
	long := strings.Repeat("a", MaxEmojiShortcodeLen+10)
	es := collectEmoji(parseAST(t, ":"+long+":"))
	require.Empty(t, es)

	atLimit := strings.Repeat("b", MaxEmojiShortcodeLen)
	es = collectEmoji(parseAST(t, ":"+atLimit+":"))
	require.Len(t, es, 1)
	require.Equal(t, atLimit, es[0].Shortcode)
}

// TestPlainTextDoesNotPanic ensures the inline parsers tolerate arbitrary
// ASCII garbage as a smoke check ahead of the fuzz harness.
func TestPlainTextDoesNotPanic(t *testing.T) {
	for _, b := range []byte("@~:.!?,;") {
		input := bytes.Repeat([]byte{b}, 200)
		require.NotPanics(t, func() {
			parseAST(t, string(input))
		})
	}
}
