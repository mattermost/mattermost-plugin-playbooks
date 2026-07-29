// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mattermost

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/yuin/goldmark"
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
)

func TestExtensionRegistersInlineParsers(t *testing.T) {
	md := goldmark.New(goldmark.WithExtensions(Extension))
	doc := md.Parser().Parse(text.NewReader([]byte("@alice sees ~ops and :rocket: now")))

	var mentions, channels, emoji int
	_ = gast.Walk(doc, func(n gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}
		switch n.(type) {
		case *Mention:
			mentions++
		case *ChannelLink:
			channels++
		case *EmojiText:
			emoji++
		}
		return gast.WalkContinue, nil
	})
	require.Equal(t, 1, mentions)
	require.Equal(t, 1, channels)
	require.Equal(t, 1, emoji)
}

// TestCodeSpanProtectsMattermostTokens confirms inline code wins over the
// mattermost inline parsers (priority 100 vs 250+). A `:rocket:` inside
// backticks must be preserved as raw text.
func TestCodeSpanProtectsMattermostTokens(t *testing.T) {
	md := goldmark.New(goldmark.WithExtensions(Extension))
	doc := md.Parser().Parse(text.NewReader([]byte("`@alice :rocket: ~ops`")))

	var emoji, mentions, channels int
	_ = gast.Walk(doc, func(n gast.Node, entering bool) (gast.WalkStatus, error) {
		if !entering {
			return gast.WalkContinue, nil
		}
		switch n.(type) {
		case *Mention:
			mentions++
		case *ChannelLink:
			channels++
		case *EmojiText:
			emoji++
		}
		return gast.WalkContinue, nil
	})
	require.Zero(t, mentions, "code span must protect mentions")
	require.Zero(t, channels, "code span must protect channel links")
	require.Zero(t, emoji, "code span must protect emoji")
}

func TestFileEmbedIsPlainStruct(t *testing.T) {
	f := FileEmbed{FileID: "abc", Name: "report.pdf", Size: 12, Kind: "doc"}
	require.Equal(t, "abc", f.FileID)
	require.Equal(t, "report.pdf", f.Name)
}
