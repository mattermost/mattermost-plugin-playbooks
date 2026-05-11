// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mattermost

import (
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

// MaxEmojiShortcodeLen caps the identifier length consumed between two
// colons in a `:shortcode:` token.
const MaxEmojiShortcodeLen = 64

// KindEmojiText is the goldmark NodeKind for EmojiText nodes.
//
// The node name carries "Text" because in v1 the downstream renderer emits
// the literal `:shortcode:` as an inline-code chip rather than a colour
// glyph (glyph rendering ships as MM-68723 in v1.1).
var KindEmojiText = gast.NewNodeKind("MattermostEmojiText")

// EmojiText is the AST node for `:shortcode:`.
type EmojiText struct {
	gast.BaseInline

	// Shortcode is the identifier between the two colons.
	Shortcode string
}

// Kind implements ast.Node.
func (n *EmojiText) Kind() gast.NodeKind { return KindEmojiText }

// Dump implements ast.Node.
func (n *EmojiText) Dump(source []byte, level int) {
	gast.DumpHelper(n, source, level, map[string]string{"Shortcode": n.Shortcode}, nil)
}

// NewEmojiText builds an EmojiText node.
func NewEmojiText(shortcode string) *EmojiText { return &EmojiText{Shortcode: shortcode} }

type emojiTextParser struct{}

// NewEmojiTextParser returns an inline parser that recognizes Mattermost
// custom emoji shortcodes (`:shortcode:`).
func NewEmojiTextParser() parser.InlineParser { return &emojiTextParser{} }

func (p *emojiTextParser) Trigger() []byte { return []byte{':'} }

func (p *emojiTextParser) Parse(parent gast.Node, block text.Reader, pc parser.Context) gast.Node {
	line, _ := block.PeekLine()
	if len(line) < 3 || line[0] != ':' {
		return nil
	}

	end := 1
	for end < len(line) && end <= MaxEmojiShortcodeLen+1 && isEmojiByte(line[end]) {
		end++
	}
	if end == 1 {
		return nil
	}
	if end-1 > MaxEmojiShortcodeLen {
		return nil
	}
	if end >= len(line) || line[end] != ':' {
		return nil
	}
	shortcode := string(line[1:end])
	block.Advance(end + 1)
	return NewEmojiText(shortcode)
}

func isEmojiByte(b byte) bool {
	switch {
	case b >= 'a' && b <= 'z':
		return true
	case b >= 'A' && b <= 'Z':
		return true
	case b >= '0' && b <= '9':
		return true
	case b == '_' || b == '-' || b == '+':
		return true
	}
	return false
}
