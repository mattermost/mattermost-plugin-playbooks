// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"strconv"
	"strings"

	"github.com/johnfercher/maroto/v2/pkg/components/col"
	"github.com/johnfercher/maroto/v2/pkg/components/line"
	"github.com/johnfercher/maroto/v2/pkg/components/row"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	"github.com/johnfercher/maroto/v2/pkg/config"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/consts/orientation"
	"github.com/johnfercher/maroto/v2/pkg/consts/pagesize"
	"github.com/johnfercher/maroto/v2/pkg/core"
	"github.com/johnfercher/maroto/v2/pkg/core/entity"
	"github.com/johnfercher/maroto/v2/pkg/props"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report/markdown"
)

// buildMarotoConfig constructs the maroto config for one render. A fresh
// config is built per-request because page size + header title are
// per-request data.
//
// Font family selection: when the embedded font pack is populated (Phase
// A2+), the renderer uses the custom Noto Sans faces; otherwise it falls
// back to maroto's bundled families so the renderer remains functional
// during Phase A1 while font bytes are not yet embedded.
func buildMarotoConfig(fonts FontPack, pageSize PageSize, labels *Labels, docTitle string) (*entity.Config, styleSet) {
	customFonts := buildCustomFonts(fonts)
	styles := newStyleSet(hasSansFamily(customFonts), hasMonoFamily(customFonts))

	b := config.NewBuilder().
		WithPageSize(toMarotoPageSize(pageSize)).
		WithLeftMargin(15).
		WithRightMargin(15).
		WithTopMargin(15).
		WithBottomMargin(18).
		WithMaxGridSize(12).
		WithDefaultFont(&props.Font{
			Family: styles.sans,
			Style:  fontstyle.Normal,
			Size:   fontSizeBody,
			Color:  primary(),
		}).
		WithPageNumber(props.PageNumber{
			Pattern: labels.Page(0, 0),
			Place:   props.RightBottom,
			Family:  styles.sans,
			Size:    fontSizeFooter,
			Color:   muted(),
		})

	if len(customFonts) > 0 {
		b = b.WithCustomFonts(customFonts)
	}

	if docTitle != "" {
		b = b.WithTitle(docTitle, true).WithCreator("Mattermost Playbooks", true)
	}

	return b.Build(), styles
}

func hasSansFamily(cfs []*entity.CustomFont) bool {
	for _, c := range cfs {
		if c.Family == fontFamilySans {
			return true
		}
	}
	return false
}

func hasMonoFamily(cfs []*entity.CustomFont) bool {
	for _, c := range cfs {
		if c.Family == fontFamilyMono {
			return true
		}
	}
	return false
}

// toMarotoPageSize maps the renderer's PageSize enum to maroto's type.
func toMarotoPageSize(p PageSize) pagesize.Type {
	if p == PageSizeLetter {
		return pagesize.Letter
	}
	return pagesize.A4
}

// buildCustomFonts emits maroto CustomFont entries from a FontPack. Empty
// faces are skipped — during Phase A1 the pack is empty and maroto falls
// back to its bundled defaults.
func buildCustomFonts(fp FontPack) []*entity.CustomFont {
	out := make([]*entity.CustomFont, 0, 5)
	add := func(family string, style fontstyle.Type, bytes []byte) {
		if len(bytes) == 0 {
			return
		}
		out = append(out, &entity.CustomFont{Family: family, Style: style, Bytes: bytes})
	}
	add(fontFamilySans, fontstyle.Normal, fp.NotoSansRegular)
	add(fontFamilySans, fontstyle.Bold, fp.NotoSansBold)
	add(fontFamilySans, fontstyle.Italic, fp.NotoSansItalic)
	add(fontFamilySans, fontstyle.BoldItalic, fp.NotoSansBoldItalic)
	add(fontFamilyMono, fontstyle.Normal, fp.NotoSansMono)
	return out
}

// registerHeaderFooter wires the per-request header / footer onto a maroto
// instance. The header carries the document title; the footer is the page
// number drawn by maroto via WithPageNumber.
func registerHeaderFooter(m core.Maroto, styles styleSet, docTitle string) error {
	headerRow := row.New(rowHeightHeader).Add(
		col.New(12).Add(text.New(docTitle, styles.headerTitle())),
	)
	return m.RegisterHeader(headerRow)
}

// addBlankRow inserts vertical whitespace.
func addBlankRow(m core.Maroto, height float64) {
	m.AddRow(height, col.New(12))
}

// addDivider inserts a thin horizontal rule.
func addDivider(m core.Maroto) {
	c := subtle()
	m.AddRow(rowHeightSeparator, col.New(12).Add(line.New(props.Line{
		Color:     c,
		Thickness: 0.2,
	})))
}

// addSectionHeading emits a top-level section heading row.
func addSectionHeading(m core.Maroto, styles styleSet, s string) {
	m.AddRow(rowHeightSection, col.New(12).Add(text.New(s, styles.heading1())))
	addDivider(m)
	addBlankRow(m, rowHeightBlockGap)
}

// addSubHeading emits a sub-section heading row.
func addSubHeading(m core.Maroto, styles styleSet, s string) {
	m.AddRow(rowHeightLine+1, col.New(12).Add(text.New(s, styles.heading2())))
}

// addCardHeading emits a small heading inside a card.
func addCardHeading(m core.Maroto, styles styleSet, s string) {
	m.AddRow(rowHeightLine, col.New(12).Add(text.New(s, styles.heading3())))
}

// addLabelValue emits a "Label: value" pair row.
func addLabelValue(m core.Maroto, styles styleSet, label, value string) {
	if value == "" {
		value = "—"
	}
	m.AddRow(rowHeightLine,
		col.New(3).Add(text.New(label, styles.label())),
		col.New(9).Add(text.New(value, styles.body())),
	)
}

// addBodyText emits one or more body-text rows from a possibly multi-line string.
func addBodyText(m core.Maroto, styles styleSet, s string) {
	if s == "" {
		return
	}
	for _, ln := range strings.Split(s, "\n") {
		if ln == "" {
			addBlankRow(m, rowHeightBlockGap)
			continue
		}
		m.AddAutoRow(col.New(12).Add(text.New(ln, styles.body())))
	}
}

// addMutedText emits a muted body line.
func addMutedText(m core.Maroto, styles styleSet, s string) {
	if s == "" {
		return
	}
	m.AddAutoRow(col.New(12).Add(text.New(s, styles.meta())))
}

// indentRule renders a left-edge vertical rule for the narrow indent column
// used by task-list rendering, matching the in-app Playbooks task UI which
// nests items under a checklist header behind a vertical guide line.
func indentRule() core.Col {
	return col.New(1).Add(line.New(props.Line{
		Color:         subtle(),
		Thickness:     0.6,
		Orientation:   orientation.Vertical,
		OffsetPercent: 30,
		SizePercent:   100,
	}))
}

// addTaskRow emits a top-level task line: vertical rule + bullet glyph + title.
// glyph is a state marker drawn from taskGlyph(state).
func addTaskRow(m core.Maroto, styles styleSet, glyph, title string) {
	bullet := glyph
	if bullet == "" {
		bullet = "•"
	}
	m.AddAutoRow(
		indentRule(),
		col.New(1).Add(text.New(bullet, styles.bodyBold())),
		col.New(10).Add(text.New(title, styles.bodyBold())),
	)
}

// addTaskIndentedLine emits an indented secondary line under a task (meta /
// description). Sits behind the same vertical rule as its parent row.
func addTaskIndentedLine(m core.Maroto, styles styleSet, s string, t props.Text) {
	if s == "" {
		return
	}
	m.AddAutoRow(
		indentRule(),
		col.New(1),
		col.New(10).Add(text.New(s, t)),
	)
}

// renderIndentedMarkdownInto routes markdown through the same vertical-rule
// indent as task meta lines.
func renderIndentedMarkdownInto(m core.Maroto, styles styleSet, body string, rt ResolverTable) {
	body = strings.TrimSpace(body)
	if body == "" {
		return
	}
	for _, ln := range strings.Split(body, "\n") {
		if ln == "" {
			addBlankRow(m, rowHeightBlockGap)
			continue
		}
		addTaskIndentedLine(m, styles, ln, styles.body())
	}
}

// taskGlyph maps a checklist-item state to its bracketed text glyph. Uses
// ASCII so it renders reliably under any font (the embedded Noto Sans pack
// is gated behind Phase A2; until then Helvetica/Courier fallback applies).
func taskGlyph(state string) string {
	switch state {
	case "Closed":
		return "[x]"
	case "Skipped":
		return "[~]"
	default:
		return "[ ]"
	}
}

// renderMarkdownInto is the bridge to the markdown extension. The body is
// parsed once via markdown.Render and the resulting instruction stream is
// dispatched to maroto primitives. Inline emphasis (bold/italic/code) is
// flattened to text in v1; rich-style runs land with v1.1 polish.
func renderMarkdownInto(m core.Maroto, styles styleSet, body string, rt ResolverTable) {
	body = strings.TrimSpace(body)
	if body == "" {
		return
	}
	instructions := markdown.Render([]byte(body), rt)
	if len(instructions) == 0 {
		addBodyText(m, styles, body)
		return
	}
	for _, ins := range instructions {
		dispatchInstruction(m, styles, ins)
	}
}

func dispatchInstruction(m core.Maroto, styles styleSet, ins markdown.Instruction) {
	switch v := ins.(type) {
	case markdown.HeadingI:
		text := flattenInline(v.Children)
		if text != "" {
			addSubHeading(m, styles, text)
		}
	case markdown.ParagraphI:
		text := flattenInline(v.Children)
		if text != "" {
			addBodyText(m, styles, text)
		}
	case markdown.ListI:
		for i, item := range v.Items {
			text := flattenInline(item)
			if text == "" {
				continue
			}
			prefix := "• "
			if v.Ordered {
				prefix = strconv.Itoa(i+1) + ". "
			}
			addBodyText(m, styles, prefix+text)
		}
	case markdown.BlockquoteI:
		text := flattenInline(v.Children)
		if text != "" {
			addBodyText(m, styles, "> "+text)
		}
	case markdown.CodeBlockI:
		body := strings.TrimRight(v.Body, "\n")
		if body != "" {
			addBodyText(m, styles, body)
		}
	case markdown.TableI:
		if header := flattenInline(v.Header); header != "" {
			addBodyText(m, styles, header)
		}
		for _, row := range v.Rows {
			parts := make([]string, 0, len(row))
			for _, cell := range row {
				if c := flattenInline(cell); c != "" {
					parts = append(parts, c)
				}
			}
			if len(parts) > 0 {
				addBodyText(m, styles, strings.Join(parts, " | "))
			}
		}
	case markdown.HRI:
		addBodyText(m, styles, "———")
	case markdown.ImageI:
		alt := v.Alt
		if alt == "" {
			alt = v.URL
		}
		addBodyText(m, styles, "[image: "+alt+"]")
	case markdown.FileEmbedI:
		name := v.File.Name
		if name == "" {
			name = v.File.FileID
		}
		addBodyText(m, styles, "[file: "+name+"]")
	default:
		if text := flattenInline([]markdown.Instruction{ins}); text != "" {
			addBodyText(m, styles, text)
		}
	}
}

func flattenInline(items []markdown.Instruction) string {
	var b strings.Builder
	for _, ins := range items {
		switch v := ins.(type) {
		case markdown.TextI:
			b.WriteString(v.Text)
		case markdown.LinkI:
			label := flattenInline(v.Children)
			if label == "" {
				label = v.Href
			}
			b.WriteString(label)
			if v.Allowed && v.Href != "" && v.Href != label {
				b.WriteString(" (")
				b.WriteString(v.Href)
				b.WriteString(")")
			}
		case markdown.MentionI:
			if v.Resolved.DisplayName != "" {
				b.WriteString("@")
				b.WriteString(v.Resolved.DisplayName)
			} else {
				b.WriteString("@")
				b.WriteString(v.Name)
			}
		case markdown.ChannelLinkI:
			if v.Resolved.DisplayName != "" {
				b.WriteString("~")
				b.WriteString(v.Resolved.DisplayName)
			} else {
				b.WriteString("~")
				b.WriteString(v.Name)
			}
		case markdown.EmojiI:
			b.WriteString(":")
			b.WriteString(v.Shortcode)
			b.WriteString(":")
		case markdown.ImageI:
			alt := v.Alt
			if alt == "" {
				alt = v.URL
			}
			b.WriteString("[image: ")
			b.WriteString(alt)
			b.WriteString("]")
		case markdown.SoftBreakI:
			b.WriteString(" ")
		case markdown.HardBreakI:
			b.WriteString("\n")
		case markdown.ParagraphI:
			b.WriteString(flattenInline(v.Children))
		}
	}
	return strings.TrimSpace(b.String())
}

// countingWriter wraps a byte counter for size enforcement against MaxBytes.
//
// Reserved for a future streaming variant; maroto v2.4.0 only exposes a
// post-build GetBytes(), so today the renderer measures the buffer after
// Generate() returns.
type countingWriter struct {
	n int64
}

func (c *countingWriter) Write(p []byte) (int, error) {
	c.n += int64(len(p))
	return len(p), nil
}

func (c *countingWriter) Bytes() int64 { return c.n }

// resolveUserDisplay returns the best display string for a user, falling back
// to username, then to the unknown-user label.
func resolveUserDisplay(rt ResolverTable, id string, labels *Labels) string {
	if id == "" {
		return labels.UnknownUser()
	}
	if rt.Users != nil {
		if u, ok := rt.Users[id]; ok {
			if u.DisplayName != "" {
				return u.DisplayName
			}
			if u.Username != "" {
				return "@" + u.Username
			}
		}
	}
	return labels.UnknownUser()
}
