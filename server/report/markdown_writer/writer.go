// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package markdown_writer walks a report.RenderContext (or
// PlaybookRenderContext) and emits canonical Mattermost-flavored markdown.
//
// This package is the source of truth for the `.md` export path. The HTML
// and PDF stages render this markdown — they never re-walk the context.
package markdown_writer

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
)

// metaSep is the separator used between key/value items in a metadata strip:
// two spaces, middle-dot, two spaces.
const metaSep = "  ·  "

// redactedUser is the deny sentinel for an unresolvable user.
const redactedUser = "@_redacted_user_"

// redactedChannel is the deny sentinel for an unresolvable channel.
const redactedChannel = "~_redacted_channel_"

// resolveUser returns "@<username>" for a known user, or the redacted
// sentinel when the ID is empty or absent from the resolver table.
func resolveUser(rt report.ResolverTable, id string) string {
	if id == "" {
		return redactedUser
	}
	if u, ok := rt.Users[id]; ok {
		if u.Username != "" {
			return "@" + u.Username
		}
	}
	return redactedUser
}

// resolveChannel returns "~<name>" for a known channel, or the redacted
// sentinel when the ID is empty or absent from the resolver table.
func resolveChannel(rt report.ResolverTable, id string) string {
	if id == "" {
		return redactedChannel
	}
	if c, ok := rt.Channels[id]; ok {
		if c.Name != "" {
			return "~" + c.Name
		}
	}
	return redactedChannel
}

// formatDate formats a Unix-millis timestamp as "YYYY-MM-DD HH:MM" UTC.
// Zero or negative values render as the empty string so callers can decide
// whether to omit the field entirely.
func formatDate(ms int64) string {
	if ms <= 0 {
		return ""
	}
	return time.UnixMilli(ms).UTC().Format("2006-01-02 15:04")
}

// formatDuration renders a millisecond duration in the highest two units:
// "4m 30s", "2h 15m", "1d 4h". Zero or negative values render as an empty
// string.
func formatDuration(ms int64) string {
	if ms <= 0 {
		return ""
	}
	d := time.Duration(ms) * time.Millisecond

	days := int64(d / (24 * time.Hour))
	d -= time.Duration(days) * 24 * time.Hour
	hours := int64(d / time.Hour)
	d -= time.Duration(hours) * time.Hour
	mins := int64(d / time.Minute)
	d -= time.Duration(mins) * time.Minute
	secs := int64(d / time.Second)

	// Highest two units only.
	switch {
	case days > 0:
		return fmt.Sprintf("%dd %dh", days, hours)
	case hours > 0:
		return fmt.Sprintf("%dh %dm", hours, mins)
	case mins > 0:
		return fmt.Sprintf("%dm %ds", mins, secs)
	default:
		return fmt.Sprintf("%ds", secs)
	}
}

// statusDisplay renders the canonical display string for a run status code.
func statusDisplay(code string) string {
	switch code {
	case coretypes.RunStatusInProgress:
		return "In Progress"
	case coretypes.RunStatusFinished:
		return "Finished"
	default:
		return code
	}
}

// metaItem is a single key/value pair in a metadata strip.
type metaItem struct {
	Key   string
	Value string
}

// writeMetaStrip writes a single-line metadata strip in the canonical
// `**Key**: value  ·  **Key**: value` form, followed by a trailing newline.
// Items with empty Value are skipped.
func writeMetaStrip(b *bytes.Buffer, items []metaItem) {
	parts := make([]string, 0, len(items))
	for _, it := range items {
		if it.Value == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("**%s**: %s", it.Key, it.Value))
	}
	if len(parts) == 0 {
		return
	}
	b.WriteString(strings.Join(parts, metaSep))
	b.WriteString("\n")
}

// writeHeading writes a heading line ("# ", "## ", "### ") followed by a
// blank line.
func writeHeading(b *bytes.Buffer, level int, text string) {
	for i := 0; i < level; i++ {
		b.WriteByte('#')
	}
	b.WriteByte(' ')
	b.WriteString(text)
	b.WriteString("\n\n")
}

// writeEmpty writes the italic empty-section placeholder.
func writeEmpty(b *bytes.Buffer, thing string) {
	b.WriteString("_No ")
	b.WriteString(thing)
	b.WriteString("._\n\n")
}

// writeBody writes a markdown body (passed through as-is, trimmed) followed
// by a blank line. Empty bodies are skipped.
func writeBody(b *bytes.Buffer, body string) {
	body = strings.TrimSpace(body)
	if body == "" {
		return
	}
	b.WriteString(body)
	b.WriteString("\n\n")
}

// writeFooter writes the trailing horizontal rule + generated-at line.
func writeFooter(b *bytes.Buffer, generatedAtMs int64) {
	b.WriteString("---\n\n")
	when := formatDate(generatedAtMs)
	if when == "" {
		when = "unknown"
	}
	fmt.Fprintf(b, "_Generated %s UTC._\n", when)
}

// countClosed returns (done, total) for a checklist item slice. "Done"
// counts both Closed and Skipped (matches the PDF renderer).
func countClosed(items []report.RenderChecklistItem) (int, int) {
	done := 0
	for _, it := range items {
		if it.State == coretypes.ChecklistItemStateClosed || it.State == coretypes.ChecklistItemStateSkipped {
			done++
		}
	}
	return done, len(items)
}

// taskBullet returns the markdown task-list bullet for a checklist state.
func taskBullet(state string) string {
	switch state {
	case coretypes.ChecklistItemStateClosed:
		return "- [x] "
	case coretypes.ChecklistItemStateSkipped:
		return "- [-] "
	default:
		return "- [ ] "
	}
}

// writeChecklist writes a single checklist (header + items) using the
// canonical format. When omitAssigneeMeta is true (playbook templates),
// the assignee/due meta line is suppressed.
func writeChecklist(b *bytes.Buffer, cl report.RenderChecklist, rt report.ResolverTable, omitAssigneeMeta bool, fallbackTitle string) {
	title := cl.Title
	if title == "" {
		title = fallbackTitle
	}
	done, total := countClosed(cl.Items)
	pct := 0
	if total > 0 {
		pct = (done * 100) / total
	}
	writeHeading(b, 3, fmt.Sprintf("%s (%d/%d · %d%%)", title, done, total, pct))

	if len(cl.Items) == 0 {
		writeEmpty(b, "tasks")
		return
	}

	for _, it := range cl.Items {
		b.WriteString(taskBullet(it.State))
		b.WriteString(it.Title)
		b.WriteString("\n")

		if !omitAssigneeMeta {
			meta := buildTaskMeta(it, rt)
			if meta != "" {
				b.WriteString("  *(")
				b.WriteString(meta)
				b.WriteString(")*\n")
			}
		}
		if desc := strings.TrimSpace(it.Description); desc != "" {
			b.WriteString("\n")
			for _, ln := range strings.Split(desc, "\n") {
				b.WriteString("    ")
				b.WriteString(ln)
				b.WriteString("\n")
			}
		}
		if it.Command != "" {
			b.WriteString("    `")
			b.WriteString(it.Command)
			b.WriteString("`\n")
		}
	}
	b.WriteString("\n")
}

// buildTaskMeta composes the `Assignee: @x, Due: YYYY-MM-DD` meta string
// for a run-instance checklist item.
func buildTaskMeta(it report.RenderChecklistItem, rt report.ResolverTable) string {
	parts := make([]string, 0, 2)
	if it.AssigneeID != "" {
		parts = append(parts, "Assignee: "+resolveUser(rt, it.AssigneeID))
	} else {
		parts = append(parts, "Unassigned")
	}
	if it.DueAtMs > 0 {
		parts = append(parts, "Due: "+formatDate(it.DueAtMs))
	}
	return strings.Join(parts, ", ")
}

// writeTranscriptThreaded renders posts as root + collated replies (per
// report.CollateThreads — grouping is by RootID, with CreateAt used only
// for display order). Orphan replies whose parent isn't in the slice
// render under a dedicated subsection so the reader knows the parent
// existed and is missing.
func writeTranscriptThreaded(b *bytes.Buffer, posts []report.RenderPost, rt report.ResolverTable) {
	threads, orphans := report.CollateThreads(posts)
	for ti, thread := range threads {
		for i, p := range thread {
			writeTranscriptPost(b, p, rt, i > 0)
		}
		if ti < len(threads)-1 || len(orphans) > 0 {
			b.WriteString(">\n")
		}
	}
	if len(orphans) > 0 {
		b.WriteString("\n_Orphan replies (parent message is outside this transcript)_\n\n")
		for i, p := range orphans {
			writeTranscriptPost(b, p, rt, true)
			if i < len(orphans)-1 {
				b.WriteString(">\n")
			}
		}
	}
	b.WriteString("\n")
}

// writeTranscriptChronological renders posts in strict CreateAt order.
// Replies carry a ↳ indicator and reference their parent. Orphans render
// with a "(parent not in transcript)" suffix.
func writeTranscriptChronological(b *bytes.Buffer, posts []report.RenderPost, rt report.ResolverTable) {
	ordered := make([]report.RenderPost, len(posts))
	copy(ordered, posts)
	sort.SliceStable(ordered, func(i, j int) bool {
		return ordered[i].CreateAt < ordered[j].CreateAt
	})
	// Build PostID → author lookup for reply parent labels.
	authorOf := make(map[string]string, len(ordered))
	for _, p := range ordered {
		authorOf[p.PostID] = resolveUser(rt, p.AuthorID)
	}
	for i, p := range ordered {
		author := resolveUser(rt, p.AuthorID)
		when := formatDate(p.CreateAt)
		switch {
		case p.RootID == "":
			fmt.Fprintf(b, "> **%s** — %s\n", author, when)
		case authorOf[p.RootID] != "":
			fmt.Fprintf(b, "> ↳ **%s** — %s  *(reply to %s)*\n", author, when, authorOf[p.RootID])
		default:
			fmt.Fprintf(b, "> ↳ **%s** — %s  *(reply to message not in transcript)*\n", author, when)
		}
		body := strings.TrimSpace(p.Message)
		if body != "" {
			for _, ln := range strings.Split(body, "\n") {
				b.WriteString("> ")
				b.WriteString(ln)
				b.WriteString("\n")
			}
		}
		if i < len(ordered)-1 {
			b.WriteString(">\n")
		}
	}
	b.WriteString("\n")
}

// writeTranscriptPost writes a single post in the transcript. isReply
// switches between root (`> **@user** — ts`) and reply (`> ↳ **@user** — ts`)
// chrome, with body lines re-indented accordingly.
func writeTranscriptPost(b *bytes.Buffer, p report.RenderPost, rt report.ResolverTable, isReply bool) {
	author := resolveUser(rt, p.AuthorID)
	when := formatDate(p.CreateAt)

	if isReply {
		fmt.Fprintf(b, "> ↳ **%s** — %s\n", author, when)
	} else {
		fmt.Fprintf(b, "> **%s** — %s\n", author, when)
	}

	body := strings.TrimSpace(p.Message)
	if body == "" {
		return
	}
	for _, ln := range strings.Split(body, "\n") {
		if isReply {
			b.WriteString(">   ")
		} else {
			b.WriteString("> ")
		}
		b.WriteString(ln)
		b.WriteString("\n")
	}
}
