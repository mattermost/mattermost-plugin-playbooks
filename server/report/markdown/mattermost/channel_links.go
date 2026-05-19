// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mattermost

import (
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

// MaxChannelLinkLen caps the identifier length consumed after `~`.
const MaxChannelLinkLen = 256

// KindChannelLink is the goldmark NodeKind for ChannelLink nodes.
var KindChannelLink = gast.NewNodeKind("MattermostChannelLink")

// ChannelLink is the AST node for `~channel-name`.
type ChannelLink struct {
	gast.BaseInline

	// Name is the channel slug (the bytes after `~`).
	Name string
}

// Kind implements ast.Node.
func (n *ChannelLink) Kind() gast.NodeKind { return KindChannelLink }

// Dump implements ast.Node.
func (n *ChannelLink) Dump(source []byte, level int) {
	gast.DumpHelper(n, source, level, map[string]string{"Name": n.Name}, nil)
}

// NewChannelLink builds a ChannelLink node.
func NewChannelLink(name string) *ChannelLink { return &ChannelLink{Name: name} }

type channelLinkParser struct{}

// NewChannelLinkParser returns an inline parser that recognizes
// Mattermost channel references (`~channel-slug`).
func NewChannelLinkParser() parser.InlineParser { return &channelLinkParser{} }

func (p *channelLinkParser) Trigger() []byte { return []byte{'~'} }

func (p *channelLinkParser) Parse(parent gast.Node, block text.Reader, pc parser.Context) gast.Node {
	line, _ := block.PeekLine()
	if len(line) < 2 || line[0] != '~' {
		return nil
	}

	before := block.PrecendingCharacter()
	if !isMentionBoundary(before) {
		return nil
	}

	end := 1
	for end < len(line) && end <= MaxChannelLinkLen+1 && isChannelByte(line[end]) {
		end++
	}
	if end == 1 {
		return nil
	}
	if end-1 > MaxChannelLinkLen {
		return nil
	}
	name := string(trimTrailingPunct(line[1:end]))
	if name == "" {
		return nil
	}
	block.Advance(1 + len(name))
	return NewChannelLink(name)
}

func isChannelByte(b byte) bool {
	switch {
	case b >= 'a' && b <= 'z':
		return true
	case b >= 'A' && b <= 'Z':
		return true
	case b >= '0' && b <= '9':
		return true
	case b == '-' || b == '_':
		return true
	}
	return false
}
