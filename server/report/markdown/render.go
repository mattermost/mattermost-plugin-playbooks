// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package markdown parses Mattermost-flavored markdown into a typed stream
// of Instruction values that downstream PDF section renderers consume. The
// package performs no I/O, no network access, and no resolver lookups —
// caller-supplied report.ResolverTable is the sole source of display data
// for mentions, channel links, and file embeds.
package markdown

import (
	"net/url"
	"strings"

	"github.com/yuin/goldmark"
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	extast "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/text"

	report "github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
	mm "github.com/mattermost/mattermost-plugin-playbooks/server/report/markdown/mattermost"
)

// Instruction is the typed unit of the rendered markdown stream. All
// concrete types in this package implement this interface.
type Instruction interface{ isInstruction() }

// Mark classifies inline text formatting applied to a TextI.
type Mark int

const (
	// MarkBold flags strong / bold emphasis.
	MarkBold Mark = 1 << iota
	// MarkItalic flags italic / em emphasis.
	MarkItalic
	// MarkCode flags inline code formatting.
	MarkCode
	// MarkStrikethrough flags GFM strikethrough.
	MarkStrikethrough
)

// HeadingI represents `# heading`.
type HeadingI struct {
	Level    int
	Children []Instruction
}

// ParagraphI represents a paragraph block.
type ParagraphI struct {
	Children []Instruction
}

// TextI represents a run of text with formatting marks.
type TextI struct {
	Text  string
	Marks Mark
}

// LinkI represents `[label](href)`. Allowed reflects the scheme allowlist
// (http / https / mailto, case-insensitive). When false the PDF renderer
// emits inert text instead of a clickable URI action (plan §3.2 / MF-2).
type LinkI struct {
	Href     string
	Children []Instruction
	Allowed  bool
}

// MentionI represents `@user` / `@here` / `@channel` / `@all`.
//
// When Resolved is zero-valued the requester cannot see the target; the
// downstream renderer treats it as literal text `@Name` (plan §3.6.6).
type MentionI struct {
	Kind     mm.MentionKind
	Name     string
	Resolved report.RenderUser
}

// ChannelLinkI represents `~channel-slug`.
//
// When Resolved is zero-valued the requester cannot see the channel; the
// downstream renderer treats it as literal text `~name`.
type ChannelLinkI struct {
	Name     string
	Resolved report.RenderChannel
}

// EmojiI represents `:shortcode:`. Always rendered as an inline-code chip
// in v1; glyph rendering ships as MM-68723 in v1.1.
type EmojiI struct {
	Shortcode string
}

// CodeBlockI represents an indented or fenced code block.
type CodeBlockI struct {
	Language string
	Body     string
}

// ListI represents an ordered or bullet list.
type ListI struct {
	Ordered bool
	Items   [][]Instruction
}

// BlockquoteI represents a `>` block.
type BlockquoteI struct {
	Children []Instruction
}

// TableI represents a GFM table.
type TableI struct {
	Header []Instruction
	Rows   [][][]Instruction
}

// HRI represents `---` / `***`.
type HRI struct{}

// ImageI represents `![alt](url)`. Images are always inert in v1 (no
// network fetch) — the renderer emits "Image: <alt>" text.
type ImageI struct {
	Alt string
	URL string
}

// FileEmbedI is a non-inline instruction surfaced by section renderers when
// a post carries attached files (see mattermost.FileEmbed).
type FileEmbedI struct {
	File mm.FileEmbed
}

// SoftBreakI is a soft line break inside a paragraph; rendered as a space.
type SoftBreakI struct{}

// HardBreakI is a hard line break inside a paragraph; rendered as a newline.
type HardBreakI struct{}

func (HeadingI) isInstruction()     {}
func (ParagraphI) isInstruction()   {}
func (TextI) isInstruction()        {}
func (LinkI) isInstruction()        {}
func (MentionI) isInstruction()     {}
func (ChannelLinkI) isInstruction() {}
func (EmojiI) isInstruction()       {}
func (CodeBlockI) isInstruction()   {}
func (ListI) isInstruction()        {}
func (BlockquoteI) isInstruction()  {}
func (TableI) isInstruction()       {}
func (HRI) isInstruction()          {}
func (ImageI) isInstruction()       {}
func (FileEmbedI) isInstruction()   {}
func (SoftBreakI) isInstruction()   {}
func (HardBreakI) isInstruction()   {}

// allowedURLSchemes is the scheme allowlist applied to every Link. Plan
// §3.2 / §6.1 A3.
var allowedURLSchemes = map[string]struct{}{
	"http":   {},
	"https":  {},
	"mailto": {},
}

// Render parses src as Mattermost-flavored markdown and returns the
// instruction stream. resolvers is consulted (never mutated) for mention /
// channel / file display data; zero-valued entries surface as literal text.
func Render(src []byte, resolvers report.ResolverTable) []Instruction {
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			mm.Extension,
		),
	)
	reader := text.NewReader(src)
	doc := md.Parser().Parse(reader)

	r := &walker{src: src, resolvers: resolvers}
	return r.children(doc)
}

type walker struct {
	src       []byte
	resolvers report.ResolverTable
}

func (w *walker) children(n gast.Node) []Instruction {
	var out []Instruction
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		if ins := w.node(c); ins != nil {
			out = append(out, ins)
		}
	}
	return out
}

func (w *walker) node(n gast.Node) Instruction {
	switch v := n.(type) {
	case *gast.Heading:
		return HeadingI{Level: v.Level, Children: w.inlineChildren(n)}
	case *gast.Paragraph:
		return ParagraphI{Children: w.inlineChildren(n)}
	case *gast.TextBlock:
		return ParagraphI{Children: w.inlineChildren(n)}
	case *gast.Blockquote:
		return BlockquoteI{Children: w.children(n)}
	case *gast.List:
		return w.list(v)
	case *gast.FencedCodeBlock:
		return CodeBlockI{
			Language: string(v.Language(w.src)),
			Body:     readLines(v, w.src),
		}
	case *gast.CodeBlock:
		return CodeBlockI{Body: readLines(v, w.src)}
	case *gast.ThematicBreak:
		return HRI{}
	case *extast.Table:
		return w.table(v)
	case *gast.AutoLink:
		return w.autoLink(v)
	}
	return nil
}

func (w *walker) list(l *gast.List) ListI {
	out := ListI{Ordered: l.IsOrdered()}
	for li := l.FirstChild(); li != nil; li = li.NextSibling() {
		item, ok := li.(*gast.ListItem)
		if !ok {
			continue
		}
		out.Items = append(out.Items, w.listItem(item))
	}
	return out
}

func (w *walker) listItem(li *gast.ListItem) []Instruction {
	var out []Instruction
	for c := li.FirstChild(); c != nil; c = c.NextSibling() {
		switch c.(type) {
		case *gast.TextBlock, *gast.Paragraph:
			out = append(out, w.inlineChildren(c)...)
		default:
			if ins := w.node(c); ins != nil {
				out = append(out, ins)
			}
		}
	}
	return out
}

func (w *walker) table(t *extast.Table) TableI {
	out := TableI{}
	for c := t.FirstChild(); c != nil; c = c.NextSibling() {
		switch row := c.(type) {
		case *extast.TableHeader:
			for cell := row.FirstChild(); cell != nil; cell = cell.NextSibling() {
				out.Header = append(out.Header, w.inlineChildren(cell)...)
			}
		case *extast.TableRow:
			var cols [][]Instruction
			for cell := row.FirstChild(); cell != nil; cell = cell.NextSibling() {
				cols = append(cols, w.inlineChildren(cell))
			}
			out.Rows = append(out.Rows, cols)
		}
	}
	return out
}

// inlineChildren walks inline nodes under n and emits Instructions.
func (w *walker) inlineChildren(n gast.Node) []Instruction {
	var out []Instruction
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		w.inline(c, 0, &out)
	}
	return out
}

func (w *walker) inline(n gast.Node, marks Mark, out *[]Instruction) {
	switch v := n.(type) {
	case *gast.Text:
		txt := string(v.Segment.Value(w.src))
		if txt != "" {
			*out = append(*out, TextI{Text: txt, Marks: marks})
		}
		if v.HardLineBreak() {
			*out = append(*out, HardBreakI{})
		} else if v.SoftLineBreak() {
			*out = append(*out, SoftBreakI{})
		}
	case *gast.String:
		txt := string(v.Value)
		if txt != "" {
			*out = append(*out, TextI{Text: txt, Marks: marks})
		}
	case *gast.CodeSpan:
		var buf strings.Builder
		for c := v.FirstChild(); c != nil; c = c.NextSibling() {
			switch t := c.(type) {
			case *gast.Text:
				buf.Write(t.Segment.Value(w.src))
			case *gast.String:
				buf.Write(t.Value)
			}
		}
		*out = append(*out, TextI{Text: buf.String(), Marks: marks | MarkCode})
	case *gast.Emphasis:
		add := MarkItalic
		if v.Level == 2 {
			add = MarkBold
		} else if v.Level >= 3 {
			add = MarkBold | MarkItalic
		}
		for c := v.FirstChild(); c != nil; c = c.NextSibling() {
			w.inline(c, marks|add, out)
		}
	case *gast.Link:
		href := string(v.Destination)
		children := collectInline(v, w, marks)
		*out = append(*out, LinkI{
			Href:     href,
			Children: children,
			Allowed:  isSchemeAllowed(href),
		})
	case *gast.AutoLink:
		*out = append(*out, w.autoLink(v))
	case *gast.Image:
		*out = append(*out, ImageI{Alt: imageAlt(v, w.src), URL: string(v.Destination)})
	case *gast.RawHTML:
		// Raw HTML is rendered as inert text.
		var buf strings.Builder
		for i := 0; i < v.Segments.Len(); i++ {
			seg := v.Segments.At(i)
			buf.Write(seg.Value(w.src))
		}
		if buf.Len() > 0 {
			*out = append(*out, TextI{Text: buf.String(), Marks: marks})
		}
	case *extast.Strikethrough:
		for c := v.FirstChild(); c != nil; c = c.NextSibling() {
			w.inline(c, marks|MarkStrikethrough, out)
		}
	case *mm.Mention:
		resolved := w.resolveMention(v)
		*out = append(*out, MentionI{Kind: v.MentionKind, Name: v.Name, Resolved: resolved})
	case *mm.ChannelLink:
		resolved := w.resolvers.Channels[v.Name]
		*out = append(*out, ChannelLinkI{Name: v.Name, Resolved: resolved})
	case *mm.EmojiText:
		*out = append(*out, EmojiI{Shortcode: v.Shortcode})
	}
}

func (w *walker) resolveMention(m *mm.Mention) report.RenderUser {
	if m.MentionKind != mm.MentionUser {
		return report.RenderUser{}
	}
	if u, ok := w.resolvers.Users[m.Name]; ok {
		return u
	}
	return report.RenderUser{}
}

func collectInline(n gast.Node, w *walker, marks Mark) []Instruction {
	var out []Instruction
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		w.inline(c, marks, &out)
	}
	return out
}

func (w *walker) autoLink(a *gast.AutoLink) Instruction {
	url := string(a.URL(w.src))
	label := string(a.Label(w.src))
	return LinkI{
		Href: url,
		Children: []Instruction{
			TextI{Text: label},
		},
		Allowed: isSchemeAllowed(url),
	}
}

func imageAlt(img *gast.Image, src []byte) string {
	var buf strings.Builder
	for c := img.FirstChild(); c != nil; c = c.NextSibling() {
		switch t := c.(type) {
		case *gast.Text:
			buf.Write(t.Segment.Value(src))
		case *gast.String:
			buf.Write(t.Value)
		}
	}
	return buf.String()
}

func readLines(n gast.Node, src []byte) string {
	lines := n.Lines()
	if lines == nil {
		return ""
	}
	var buf strings.Builder
	for i := 0; i < lines.Len(); i++ {
		seg := lines.At(i)
		buf.Write(seg.Value(src))
	}
	return buf.String()
}

// isSchemeAllowed implements the scheme allowlist (plan §3.2 / MF-2).
//
// The allowlist is exactly `http`, `https`, `mailto`. The check
// URL-decodes the scheme so encoded variants such as `j%61vascript:` fail,
// trims leading whitespace and ASCII control chars, and folds to lower-case.
// Anything else (including `javascript:`, `data:`, `file:`, `smb:`) returns
// false; the downstream renderer emits inert text for disallowed schemes.
func isSchemeAllowed(href string) bool {
	s := strings.TrimLeft(href, " \t\r\n\v\f")
	// Strip leading ASCII control characters (URL spec strips < 0x20).
	for len(s) > 0 && s[0] <= 0x1f {
		s = s[1:]
	}
	colon := strings.IndexByte(s, ':')
	slash := strings.IndexAny(s, "/?#")
	if colon < 0 {
		return false
	}
	if slash >= 0 && slash < colon {
		// No scheme — relative or fragment reference; treat as inert.
		return false
	}
	scheme := s[:colon]
	decoded, err := url.PathUnescape(scheme)
	if err != nil {
		return false
	}
	decoded = strings.ToLower(strings.TrimSpace(decoded))
	if decoded == "" {
		return false
	}
	if !isASCIIAlphaNumScheme(decoded) {
		return false
	}
	_, ok := allowedURLSchemes[decoded]
	return ok
}

func isASCIIAlphaNumScheme(s string) bool {
	if s == "" {
		return false
	}
	if !((s[0] >= 'a' && s[0] <= 'z') || (s[0] >= 'A' && s[0] <= 'Z')) {
		return false
	}
	for i := 1; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z':
		case c >= 'A' && c <= 'Z':
		case c >= '0' && c <= '9':
		case c == '+' || c == '-' || c == '.':
		default:
			return false
		}
	}
	return true
}
