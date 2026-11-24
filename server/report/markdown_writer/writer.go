// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package markdown_writer prints a report.RunReport as Mattermost-flavored
// markdown.
//
// This package backs the `.md` export path. Plain-text fields are escaped
// with escapeText; Markdown bodies are emitted as they are. Every @mention in
// the finished document is then made inert by inertMentions.
package markdown_writer //nolint:staticcheck

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// metaSep is the separator used between key/value items in a metadata strip:
// two spaces, middle-dot, two spaces.
const metaSep = "  ·  "

// writeMetaStrip writes a metadata strip in the canonical
// `**Key**: value  ·  **Key**: value` form as its own paragraph. Fields with
// an empty Value are skipped.
func writeMetaStrip(b *bytes.Buffer, fields []report.Field) {
	parts := make([]string, 0, len(fields))
	for _, f := range fields {
		if f.Value == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("**%s**: %s", escapeText(f.Label), escapeText(f.Value)))
	}
	if len(parts) == 0 {
		return
	}
	b.WriteString(strings.Join(parts, metaSep))
	b.WriteString("\n\n")
}

// writeDetails writes a bold title and one bullet per field with a value,
// linking the value when the field has a URL.
func writeDetails(b *bytes.Buffer, title string, fields []report.Field) {
	fmt.Fprintf(b, "**%s**\n\n", escapeText(title))
	for _, f := range fields {
		if f.Value == "" {
			continue
		}
		value := escapeText(f.Value)
		if f.URL != "" {
			value = fmt.Sprintf("[%s](%s)", value, linkDestination(f.URL))
		}
		fmt.Fprintf(b, "- **%s**: %s\n", escapeText(f.Label), value)
	}
	b.WriteString("\n")
}

// linkDestination percent-encodes the characters that would end a Markdown
// link destination early.
var linkDestination = strings.NewReplacer(" ", "%20", "(", "%28", ")", "%29", "<", "%3C", ">", "%3E").Replace

// writeStats writes headline figures as a metadata strip, each hint in
// parentheses after its value.
func writeStats(b *bytes.Buffer, stats []report.Stat) {
	fields := make([]report.Field, 0, len(stats))
	for _, s := range stats {
		value := s.Value
		if s.Hint != "" {
			value += " (" + s.Hint + ")"
		}
		fields = append(fields, report.Field{Label: s.Label, Value: value})
	}
	writeMetaStrip(b, fields)
}

// writeHeading writes a heading line ("# ", "## ", "### ") followed by a
// blank line. text is plain text.
func writeHeading(b *bytes.Buffer, level int, text string) {
	for range level {
		b.WriteByte('#')
	}
	b.WriteByte(' ')
	b.WriteString(escapeText(text))
	b.WriteString("\n\n")
}

// writeIndentedText writes plain text under a bullet, one escaped line per
// source line.
func writeIndentedText(b *bytes.Buffer, text string) {
	for ln := range strings.SplitSeq(text, "\n") {
		if ln = escapeText(ln); ln != "" {
			b.WriteString("  ")
			b.WriteString(ln)
			b.WriteString("\n")
		}
	}
}

// codeSpan shows s as inline code, or as escaped text if a backtick or line
// break would end the code span early.
func codeSpan(s string) string {
	if strings.ContainsAny(s, "`\r\n") {
		return escapeText(s)
	}
	return "`" + s + "`"
}

// writeEmpty writes an italic empty-section placeholder.
func writeEmpty(b *bytes.Buffer, text string) {
	b.WriteString("_")
	b.WriteString(escapeText(text))
	b.WriteString("_\n\n")
}

// writeBody writes a markdown body as it is, followed by a blank line.
// Empty bodies are skipped.
func writeBody(b *bytes.Buffer, body string) {
	if body == "" {
		return
	}
	b.WriteString(closeFences(body, 0))
	b.WriteString("\n\n")
}

// closeFences closes a fenced code block that body leaves open. Mattermost
// ends it with the message, but in the report it would run on into
// everything that follows. indent is how many spaces the report puts in
// front of each line, which count towards the three a fence may have.
func closeFences(body string, indent int) string {
	var fence string
	for ln := range strings.SplitSeq(body, "\n") {
		trimmed := strings.TrimLeft(ln, " ")
		if indent+len(ln)-len(trimmed) > 3 {
			continue
		}
		if fence == "" {
			if f := fenceRun(trimmed); len(f) >= 3 && (f[0] == '~' || !strings.Contains(trimmed[len(f):], "`")) {
				fence = f
			}
			continue
		}
		if f := fenceRun(trimmed); f != "" && f[0] == fence[0] && len(f) >= len(fence) && strings.TrimSpace(trimmed[len(f):]) == "" {
			fence = ""
		}
	}
	if fence == "" {
		return body
	}
	return body + "\n" + fence
}

// fenceRun returns the run of backticks or tildes that s starts with.
func fenceRun(s string) string {
	if s == "" || (s[0] != '`' && s[0] != '~') {
		return ""
	}
	n := len(s) - len(strings.TrimLeft(s, s[:1]))
	return s[:n]
}

// writeFooter writes the trailing horizontal rule + generated-at line.
func writeFooter(b *bytes.Buffer, footer string) {
	if footer == "" {
		return
	}
	b.WriteString("---\n\n_")
	b.WriteString(escapeText(footer))
	b.WriteString("_\n")
}

// writeMetrics writes a bold "Metrics" line and one bullet per metric.
func writeMetrics(b *bytes.Buffer, title string, metrics []report.Metric) {
	if len(metrics) == 0 {
		return
	}
	fmt.Fprintf(b, "**%s**\n\n", escapeText(title))
	for _, m := range metrics {
		fmt.Fprintf(b, "- **%s**: %s\n", escapeText(m.Title), escapeText(m.Value))
		writeIndentedText(b, m.Description)
	}
	b.WriteString("\n")
}

// taskBullet returns the markdown task-list bullet for a task. Markdown has
// no skipped state, so a skipped task is a plain bullet with its title struck
// through, as the run page shows it.
func taskBullet(it report.ChecklistItem) string {
	switch {
	case it.Done:
		return "- [x] "
	case it.Skipped:
		return "- "
	default:
		return "- [ ] "
	}
}

// writeChecklists writes each checklist (header + items), or the section's
// empty state when there is none.
func writeChecklists(b *bytes.Buffer, s report.ChecklistSection) {
	writeHeading(b, 2, s.Title)
	if len(s.Checklists) == 0 {
		writeEmpty(b, s.Empty)
		return
	}
	for _, cl := range s.Checklists {
		writeHeading(b, 3, fmt.Sprintf("%s (%s)", cl.Title, cl.Progress))
		if len(cl.Items) == 0 {
			writeEmpty(b, cl.Empty)
			continue
		}
		for _, it := range cl.Items {
			b.WriteString(taskBullet(it))
			if it.Skipped {
				b.WriteString("~~" + it.Title + "~~")
			} else {
				b.WriteString(it.Title)
			}
			b.WriteString("\n")

			var meta []string
			if it.Assignee != "" {
				meta = append(meta, escapeText(it.Assignee))
			}
			if it.Due != "" {
				meta = append(meta, escapeText(it.Due))
			}
			if it.Command != "" {
				meta = append(meta, codeSpan(it.Command))
			}
			if it.Completed != "" {
				meta = append(meta, escapeText(it.Completed))
			}
			if len(meta) > 0 {
				b.WriteString("  *(")
				b.WriteString(strings.Join(meta, " · "))
				b.WriteString(")*\n")
			}
			if it.Description != "" {
				b.WriteString("\n")
				writeLines(b, closeFences(it.Description, 4), "    ")
			}
		}
		b.WriteString("\n")
	}
}

// writeQuotedPost writes a transcript post as a block quote: a header line,
// then the body with each line prefixed by bodyPrefix.
func writeQuotedPost(b *bytes.Buffer, header string, body string, bodyPrefix string) {
	b.WriteString("> ")
	b.WriteString(header)
	b.WriteString("\n")
	if body == "" {
		return
	}
	// bodyPrefix is a quote marker and the space after it, then the indent.
	writeLines(b, closeFences(body, len(bodyPrefix)-len("> ")), bodyPrefix)
}

// writeLines writes each line of text after prefix.
func writeLines(b *bytes.Buffer, text, prefix string) {
	for ln := range strings.SplitSeq(text, "\n") {
		b.WriteString(prefix)
		b.WriteString(ln)
		b.WriteString("\n")
	}
}

func postHeader(p report.Post, reply bool) string {
	header := fmt.Sprintf("**%s** · %s", escapeText(p.Author), escapeText(p.Date))
	if reply {
		header = "↳ " + header
	}
	if p.ParentLabel != "" {
		header += "  *(" + escapeText(p.ParentLabel) + ")*"
	}
	return header
}

// writeTranscript writes the transcript threaded (each root followed by its
// replies, then any orphan replies under their own heading) or in
// chronological order.
func writeTranscript(b *bytes.Buffer, s report.TranscriptSection) {
	writeHeading(b, 2, s.Title)

	switch {
	case !s.HasPosts():
		writeEmpty(b, s.Empty)
	case s.Chronological:
		for i, p := range s.Posts {
			if i > 0 {
				b.WriteString(">\n")
			}
			writeQuotedPost(b, postHeader(p, p.IsReply), p.Body, "> ")
		}
		b.WriteString("\n")
	default:
		for i, t := range s.Threads {
			if i > 0 {
				b.WriteString(">\n")
			}
			writeQuotedPost(b, postHeader(t.Post, false), t.Body, "> ")
			for _, reply := range t.Replies {
				writeQuotedPost(b, postHeader(reply, true), reply.Body, ">   ")
			}
		}
		if len(s.Orphans) > 0 {
			if len(s.Threads) > 0 {
				b.WriteString("\n")
			}
			fmt.Fprintf(b, "**%s**\n\n", escapeText(s.OrphansTitle))
			writeEmpty(b, s.OrphansNote)
			for i, p := range s.Orphans {
				if i > 0 {
					b.WriteString(">\n")
				}
				writeQuotedPost(b, postHeader(p, true), p.Body, ">   ")
			}
		}
		b.WriteString("\n")
	}

	if s.Truncated != "" {
		b.WriteString("> _")
		b.WriteString(escapeText(s.Truncated))
		b.WriteString("_\n\n")
	}
}
