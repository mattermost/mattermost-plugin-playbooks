// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package mattermost defines the goldmark extension that recognizes
// Mattermost-flavored inline tokens (user mentions, channel links, custom
// emoji shortcodes) and a data type for file embeds. It does no I/O and
// reads pre-resolved display data from the caller-supplied table.
package mattermost

import (
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

// MaxMentionLen caps the identifier length consumed after `@` per
// Mattermost mention rules. Enforced before any allocation.
const MaxMentionLen = 256

// KindMention is the goldmark NodeKind for Mention nodes.
var KindMention = gast.NewNodeKind("MattermostMention")

// MentionKind classifies a parsed mention.
type MentionKind int

const (
	// MentionUser is a user mention like `@alice`.
	MentionUser MentionKind = iota + 1
	// MentionHere is the special `@here`.
	MentionHere
	// MentionChannel is the special `@channel`.
	MentionChannel
	// MentionAll is the special `@all`.
	MentionAll
)

// Mention is the AST node for `@name`.
type Mention struct {
	gast.BaseInline

	// Name is the raw identifier (the bytes after `@`).
	Name string

	// MentionKind classifies the mention as user / here / channel / all.
	MentionKind MentionKind
}

// Kind implements ast.Node.
func (n *Mention) Kind() gast.NodeKind { return KindMention }

// Dump implements ast.Node.
func (n *Mention) Dump(source []byte, level int) {
	gast.DumpHelper(n, source, level, map[string]string{"Name": n.Name}, nil)
}

// NewMention builds a Mention node.
func NewMention(name string, kind MentionKind) *Mention {
	return &Mention{Name: name, MentionKind: kind}
}

type mentionParser struct{}

// NewMentionParser returns an inline parser that recognizes Mattermost
// user mentions (`@name`, `@here`, `@channel`, `@all`).
func NewMentionParser() parser.InlineParser { return &mentionParser{} }

func (p *mentionParser) Trigger() []byte { return []byte{'@'} }

func (p *mentionParser) Parse(parent gast.Node, block text.Reader, pc parser.Context) gast.Node {
	line, _ := block.PeekLine()
	if len(line) < 2 || line[0] != '@' {
		return nil
	}

	before := block.PrecendingCharacter()
	if !isMentionBoundary(before) {
		return nil
	}

	end := 1
	for end < len(line) && end <= MaxMentionLen+1 && isMentionByte(line[end]) {
		end++
	}
	if end == 1 {
		return nil
	}
	if end-1 > MaxMentionLen {
		return nil
	}
	name := string(trimTrailingPunct(line[1:end]))
	if name == "" {
		return nil
	}

	kind := classifyMention(name)
	block.Advance(1 + len(name))
	return NewMention(name, kind)
}

func classifyMention(name string) MentionKind {
	switch name {
	case "here":
		return MentionHere
	case "channel":
		return MentionChannel
	case "all":
		return MentionAll
	default:
		return MentionUser
	}
}

func isMentionBoundary(b rune) bool {
	switch b {
	case ' ', '\t', '\n', '\r', 0, '(', '[', '{', '"', '\'', '*', '_', '~', '>', ',', '.', ':', ';', '!', '?':
		return true
	}
	return false
}

func isMentionByte(b byte) bool {
	switch {
	case b >= 'a' && b <= 'z':
		return true
	case b >= 'A' && b <= 'Z':
		return true
	case b >= '0' && b <= '9':
		return true
	case b == '.' || b == '-' || b == '_':
		return true
	}
	return false
}

func trimTrailingPunct(b []byte) []byte {
	for len(b) > 0 {
		last := b[len(b)-1]
		if last == '.' || last == '-' || last == '_' {
			b = b[:len(b)-1]
			continue
		}
		break
	}
	return b
}
