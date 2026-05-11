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
	case "InProgress":
		return "In Progress"
	case "Finished":
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
		if it.State == "Closed" || it.State == "Skipped" {
			done++
		}
	}
	return done, len(items)
}

// taskBullet returns the markdown task-list bullet for a checklist state.
func taskBullet(state string) string {
	switch state {
	case "Closed":
		return "- [x] "
	case "Skipped":
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

// groupByThread groups a chronological post slice into [root, replies...]
// runs. Posts with a RootID land under that root; orphaned replies (root
// not in the slice) are promoted to their own single-element groups.
//
// Mirrors server/report.groupByThread without importing it.
func groupByThread(posts []report.RenderPost) [][]report.RenderPost {
	type group struct {
		posts []report.RenderPost
	}
	groups := make(map[string]*group, len(posts))
	order := make([]string, 0, len(posts))

	for _, p := range posts {
		rootID := p.RootID
		if rootID == "" {
			rootID = p.PostID
		}
		g, ok := groups[rootID]
		if !ok {
			g = &group{}
			groups[rootID] = g
			order = append(order, rootID)
		}
		g.posts = append(g.posts, p)
	}

	for _, id := range order {
		g := groups[id]
		sort.SliceStable(g.posts, func(i, j int) bool {
			return g.posts[i].CreateAt < g.posts[j].CreateAt
		})
	}

	out := make([][]report.RenderPost, 0, len(order))
	for _, id := range order {
		out = append(out, groups[id].posts)
	}
	return out
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
