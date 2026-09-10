// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	report "github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
	mm "github.com/mattermost/mattermost-plugin-playbooks/server/report/markdown/mattermost"
)

func renderText(t *testing.T, src string) []Instruction {
	t.Helper()
	return Render([]byte(src), report.ResolverTable{})
}

func TestRender_Empty(t *testing.T) {
	require.Empty(t, renderText(t, ""))
}

func TestRender_Heading(t *testing.T) {
	ins := renderText(t, "# Title\n")
	require.Len(t, ins, 1)
	h, ok := ins[0].(HeadingI)
	require.True(t, ok)
	require.Equal(t, 1, h.Level)
	require.Len(t, h.Children, 1)
	require.Equal(t, TextI{Text: "Title"}, h.Children[0])
}

func TestRender_ParagraphWithMarks(t *testing.T) {
	ins := renderText(t, "Hello **bold** and *italic* and `code`")
	require.Len(t, ins, 1)
	p, ok := ins[0].(ParagraphI)
	require.True(t, ok)

	var bolds, italics, codes int
	for _, c := range p.Children {
		if tx, ok := c.(TextI); ok {
			if tx.Marks&MarkBold != 0 {
				bolds++
			}
			if tx.Marks&MarkItalic != 0 {
				italics++
			}
			if tx.Marks&MarkCode != 0 {
				codes++
			}
		}
	}
	require.Equal(t, 1, bolds)
	require.Equal(t, 1, italics)
	require.Equal(t, 1, codes)
}

func TestRender_LinkAllowedSchemes(t *testing.T) {
	cases := []struct {
		href    string
		allowed bool
	}{
		{"https://example.com", true},
		{"http://example.com", true},
		{"HTTP://example.com", true},
		{"mailto:a@b.com", true},
		{"javascript:alert(1)", false},
		{"JavaScript:alert(1)", false},
		{"j%61vascript:alert(1)", false},
		{"\tjavascript:alert(1)", false},
		{"data:text/html,foo", false},
		{"file:///etc/passwd", false},
		{"smb://share/x", false},
		{"/relative/path", false},
		{"#fragment", false},
		{"  https://example.com", true},
	}
	for _, tc := range cases {
		t.Run(tc.href, func(t *testing.T) {
			require.Equal(t, tc.allowed, isSchemeAllowed(tc.href), "href=%q", tc.href)
		})
	}
}

func TestRender_LinkEmitsAllowedFlag(t *testing.T) {
	ins := renderText(t, "see [me](javascript:alert(1)) and [ok](https://x.test)")
	require.Len(t, ins, 1)
	p := ins[0].(ParagraphI)

	var links []LinkI
	for _, c := range p.Children {
		if l, ok := c.(LinkI); ok {
			links = append(links, l)
		}
	}
	require.Len(t, links, 2)
	require.False(t, links[0].Allowed)
	require.True(t, links[1].Allowed)
}

func TestRender_MentionResolvedAndUnresolved(t *testing.T) {
	rt := report.ResolverTable{
		Users: map[string]report.RenderUser{
			"alice": {UserID: "u1", DisplayName: "Alice A", Username: "alice"},
		},
	}
	ins := Render([]byte("hi @alice and @ghost and @here"), rt)
	require.Len(t, ins, 1)
	p := ins[0].(ParagraphI)

	var mentions []MentionI
	for _, c := range p.Children {
		if m, ok := c.(MentionI); ok {
			mentions = append(mentions, m)
		}
	}
	require.Len(t, mentions, 3)
	require.Equal(t, mm.MentionUser, mentions[0].Kind)
	require.Equal(t, "Alice A", mentions[0].Resolved.DisplayName)

	require.Equal(t, mm.MentionUser, mentions[1].Kind)
	require.Equal(t, report.RenderUser{}, mentions[1].Resolved, "zero-value for unknown user")

	require.Equal(t, mm.MentionHere, mentions[2].Kind)
}

func TestRender_ChannelLinkResolvedAndUnresolved(t *testing.T) {
	rt := report.ResolverTable{
		Channels: map[string]report.RenderChannel{
			"ops-room": {ChannelID: "c1", Name: "ops-room", DisplayName: "Ops Room", Type: "O"},
		},
	}
	ins := Render([]byte("see ~ops-room and ~missing"), rt)
	p := ins[0].(ParagraphI)

	var channels []ChannelLinkI
	for _, c := range p.Children {
		if cl, ok := c.(ChannelLinkI); ok {
			channels = append(channels, cl)
		}
	}
	require.Len(t, channels, 2)
	require.Equal(t, "Ops Room", channels[0].Resolved.DisplayName)
	require.Equal(t, report.RenderChannel{}, channels[1].Resolved)
}

func TestRender_EmojiIsChip(t *testing.T) {
	ins := renderText(t, "ship it :rocket:")
	p := ins[0].(ParagraphI)

	var found bool
	for _, c := range p.Children {
		if e, ok := c.(EmojiI); ok {
			require.Equal(t, "rocket", e.Shortcode)
			found = true
		}
	}
	require.True(t, found)
}

func TestRender_CodeBlock(t *testing.T) {
	ins := renderText(t, "```go\nfunc f(){}\n```\n")
	require.Len(t, ins, 1)
	cb, ok := ins[0].(CodeBlockI)
	require.True(t, ok)
	require.Equal(t, "go", cb.Language)
	require.Contains(t, cb.Body, "func f(){}")
}

func TestRender_List(t *testing.T) {
	ins := renderText(t, "- a\n- b\n- c\n")
	require.Len(t, ins, 1)
	l, ok := ins[0].(ListI)
	require.True(t, ok)
	require.False(t, l.Ordered)
	require.Len(t, l.Items, 3)
}

func TestRender_OrderedList(t *testing.T) {
	ins := renderText(t, "1. first\n2. second\n")
	l := ins[0].(ListI)
	require.True(t, l.Ordered)
	require.Len(t, l.Items, 2)
}

func TestRender_Blockquote(t *testing.T) {
	ins := renderText(t, "> quoted\n")
	bq, ok := ins[0].(BlockquoteI)
	require.True(t, ok)
	require.NotEmpty(t, bq.Children)
}

func TestRender_ThematicBreak(t *testing.T) {
	ins := renderText(t, "before\n\n---\n\nafter\n")
	var hr int
	for _, i := range ins {
		if _, ok := i.(HRI); ok {
			hr++
		}
	}
	require.Equal(t, 1, hr)
}

func TestRender_Table(t *testing.T) {
	src := "| h1 | h2 |\n|----|----|\n| a  | b  |\n| c  | d  |\n"
	ins := renderText(t, src)
	require.Len(t, ins, 1)
	tbl, ok := ins[0].(TableI)
	require.True(t, ok)
	require.NotEmpty(t, tbl.Header)
	require.Len(t, tbl.Rows, 2)
	require.Len(t, tbl.Rows[0], 2)
}

func TestRender_Strikethrough(t *testing.T) {
	ins := renderText(t, "this is ~~gone~~ now")
	p := ins[0].(ParagraphI)
	var struck bool
	for _, c := range p.Children {
		if tx, ok := c.(TextI); ok && tx.Marks&MarkStrikethrough != 0 {
			struck = true
		}
	}
	require.True(t, struck)
}

func TestRender_Image(t *testing.T) {
	ins := renderText(t, "![alt text](https://x/y.png)")
	p := ins[0].(ParagraphI)
	require.Len(t, p.Children, 1)
	img, ok := p.Children[0].(ImageI)
	require.True(t, ok)
	require.Equal(t, "alt text", img.Alt)
	require.Equal(t, "https://x/y.png", img.URL)
}

// TestRender_LongInputNoExplosion guards against pathological allocation.
func TestRender_LongInputNoExplosion(t *testing.T) {
	src := strings.Repeat("@", 4096) + strings.Repeat(":", 4096) + strings.Repeat("~", 4096)
	require.NotPanics(t, func() {
		_ = Render([]byte(src), report.ResolverTable{})
	})
}

// TestRender_NoMutatesResolver guards the package's invariant that the
// resolver table is read-only.
func TestRender_NoMutatesResolver(t *testing.T) {
	rt := report.ResolverTable{
		Users:    map[string]report.RenderUser{"alice": {DisplayName: "A"}},
		Channels: map[string]report.RenderChannel{"ops": {DisplayName: "O"}},
	}
	before := len(rt.Users) + len(rt.Channels)
	_ = Render([]byte("@alice ~ops @nobody ~nowhere"), rt)
	after := len(rt.Users) + len(rt.Channels)
	require.Equal(t, before, after)
}
